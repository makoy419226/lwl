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
  Eye,
  EyeOff,
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
  password?: string;
  pin?: string | null;
}

interface StaffMember {
  id: number;
  name: string;
  pin: string;
  roleType: string;
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
    role: "counter",
    pin: "",
  });
  
  // Visibility toggles for password/PIN per user
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [visiblePins, setVisiblePins] = useState<Set<number>>(new Set());
  
  // Driver delivery history dialog
  const [selectedDriverHistory, setSelectedDriverHistory] = useState<{id: number; name: string} | null>(null);
  
  // Staff member management
  const [isStaffMemberCreateOpen, setIsStaffMemberCreateOpen] = useState(false);
  const [editStaffMember, setEditStaffMember] = useState<StaffMember | null>(null);
  const [staffMemberFormData, setStaffMemberFormData] = useState({
    name: "",
    pin: "",
    roleType: "counter" as "counter" | "section",
  });
  const [visibleStaffPins, setVisibleStaffPins] = useState<Set<number>>(new Set());
  
  const toggleStaffPinVisibility = (memberId: number) => {
    setVisibleStaffPins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };
  
  const togglePasswordVisibility = (userId: number) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };
  
  const togglePinVisibility = (userId: number) => {
    setVisiblePins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

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

  // Staff members for counter and section roles
  const { data: staffMembers, isLoading: isLoadingStaffMembers } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff-members"],
  });

  const counterStaffMembers = useMemo(() => {
    return staffMembers?.filter(m => m.roleType === 'counter') || [];
  }, [staffMembers]);

  const sectionStaffMembers = useMemo(() => {
    return staffMembers?.filter(m => m.roleType === 'section') || [];
  }, [staffMembers]);

  // Fetch active sessions to show online status
  const { data: activeSessions } = useQuery<{ activeUserIds: number[] }>({
    queryKey: ["/api/auth/active-sessions"],
    refetchInterval: 120000, // Refresh every 2 minutes to reduce load
  });

  const isUserOnline = (userId: number) => {
    return activeSessions?.activeUserIds?.includes(userId) || false;
  };

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

  // Use section users from users table instead of old packing_workers table
  const sectionUsers = useMemo(() => {
    return systemUsers?.filter(u => u.role === 'section') || [];
  }, [systemUsers]);

  // Driver users for delivery stats
  const driverUsers = useMemo(() => {
    return systemUsers?.filter(u => u.role === 'driver') || [];
  }, [systemUsers]);

  const workerStats = useMemo(() => {
    if (!sectionUsers.length || !orders) return [];
    const { start, end } = getDateRange();

    return sectionUsers
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
  }, [sectionUsers, orders, bills, dateFilter, customFromDate, customToDate]);

  // Driver delivery stats
  const driverStats = useMemo(() => {
    if (!driverUsers.length || !orders) return [];
    const { start, end } = getDateRange();

    return driverUsers
      .map((driver) => {
        const deliveredOrders = orders.filter((o) => {
          if (o.deliveredByWorkerId !== driver.id) return false;
          if (!o.deliveryDate) return false;
          try {
            const delDate = new Date(o.deliveryDate);
            return delDate >= start && delDate <= end;
          } catch {
            return false;
          }
        });

        return {
          driver,
          deliveredCount: deliveredOrders.length,
        };
      })
      .sort((a, b) => b.deliveredCount - a.deliveredCount);
  }, [driverUsers, orders, dateFilter, customFromDate, customToDate]);

  const driverTotals = useMemo(() => {
    return driverStats.reduce(
      (acc, s) => ({
        delivered: acc.delivered + s.deliveredCount,
      }),
      { delivered: 0 },
    );
  }, [driverStats]);

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
          Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")} | Tel: 026 815 824 | Mobile: +971 56 338 0001
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
    (s.worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()),
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
        role: "counter",
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
        role: "counter",
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

  // Staff member mutations
  const createStaffMemberMutation = useMutation({
    mutationFn: async (data: { name: string; pin: string; roleType: string }) => {
      return apiRequest("POST", "/api/staff-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-members"] });
      setIsStaffMemberCreateOpen(false);
      setStaffMemberFormData({ name: "", pin: "", roleType: "counter" });
      toast({
        title: "Staff Member Added",
        description: "New staff member has been created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create staff member",
        variant: "destructive",
      });
    },
  });

  const updateStaffMemberMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<StaffMember> }) => {
      return apiRequest("PUT", `/api/staff-members/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-members"] });
      setEditStaffMember(null);
      toast({
        title: "Staff Member Updated",
        description: "Staff member details have been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update staff member",
        variant: "destructive",
      });
    },
  });

  const deleteStaffMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/staff-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-members"] });
      toast({
        title: "Staff Member Deleted",
        description: "Staff member has been removed",
      });
    },
  });

  const handleCreateStaffMember = () => {
    if (!staffMemberFormData.name || !staffMemberFormData.pin) {
      toast({
        title: "Error",
        description: "Name and PIN are required",
        variant: "destructive",
      });
      return;
    }
    if (!/^\d{5}$/.test(staffMemberFormData.pin)) {
      toast({
        title: "Error",
        description: "PIN must be exactly 5 digits",
        variant: "destructive",
      });
      return;
    }
    createStaffMemberMutation.mutate(staffMemberFormData);
  };

  const handleUpdateStaffMember = () => {
    if (!editStaffMember) return;
    const updates: any = {};
    if (staffMemberFormData.name && staffMemberFormData.name !== editStaffMember.name) {
      updates.name = staffMemberFormData.name;
    }
    if (staffMemberFormData.pin && staffMemberFormData.pin !== editStaffMember.pin) {
      if (!/^\d{5}$/.test(staffMemberFormData.pin)) {
        toast({
          title: "Error",
          description: "PIN must be exactly 5 digits",
          variant: "destructive",
        });
        return;
      }
      updates.pin = staffMemberFormData.pin;
    }
    updateStaffMemberMutation.mutate({ id: editStaffMember.id, updates });
  };

  const toggleStaffMemberActive = (member: StaffMember) => {
    updateStaffMemberMutation.mutate({
      id: member.id,
      updates: { active: !member.active },
    });
  };

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

                <Accordion type="multiple" defaultValue={["counter", "section", "drivers"]} className="space-y-2">
                  <AccordionItem value="counter" className="border rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Counter</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({systemUsers?.filter(u => u.role === "counter").length || 0} users)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {!systemUsers?.filter(u => u.role === "counter").length ? (
                        <p className="text-center text-muted-foreground py-4">No counter users found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
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
                            {systemUsers?.filter(u => u.role === "counter").map((user) => {
                              const userBills = bills?.filter(b => b.notes?.includes(user.name || user.username)) || [];
                              const unpaidBills = userBills.filter(b => !b.isPaid);
                              return (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.name || "-"}</TableCell>
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

                  <AccordionItem value="section" className="border rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Section</Badge>
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
                                <TableCell className="text-center font-bold">
                                  {s.taggedCount + s.packedCount}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="drivers" className="border rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Drivers</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({driverStats.length} drivers) - {driverTotals.delivered} deliveries
                        </span>
                        {orders && (
                          <Badge className="bg-orange-500 text-white">
                            {orders.filter(o => o.packingDone && !o.delivered && o.deliveryType === 'delivery').length} Ready
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {orders && orders.filter(o => o.packingDone && !o.delivered && o.deliveryType === 'delivery').length > 0 && (
                        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                            <Package className="w-5 h-5" />
                            <span className="font-semibold">
                              {orders.filter(o => o.packingDone && !o.delivered && o.deliveryType === 'delivery').length} orders ready for delivery
                            </span>
                          </div>
                        </div>
                      )}
                      {driverStats.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No drivers found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Driver Name</TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Truck className="w-4 h-4 text-green-500" />
                                  Delivered
                                </div>
                              </TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {driverStats.map((s) => (
                              <TableRow key={s.driver.id} data-testid={`row-driver-stats-${s.driver.id}`}>
                                <TableCell className="font-medium">
                                  {s.driver.name || s.driver.username}
                                  {!s.driver.active && (
                                    <Badge variant="secondary" className="ml-2">
                                      Inactive
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40"
                                    onClick={() => setSelectedDriverHistory({ id: s.driver.id, name: s.driver.name || s.driver.username })}
                                    data-testid={`badge-driver-delivered-${s.driver.id}`}
                                  >
                                    {s.deliveredCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={s.driver.active ? "default" : "secondary"}>
                                    {s.driver.active ? "Active" : "Inactive"}
                                  </Badge>
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
                    <Accordion type="multiple" defaultValue={["counter", "section", "driver"]} className="space-y-2">
                      <AccordionItem value="counter" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Counter</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({systemUsers.filter(u => u.role === "counter").length} login{systemUsers.filter(u => u.role === "counter").length !== 1 ? "s" : ""}, {counterStaffMembers.length} staff)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Login Details</h4>
                              {systemUsers.filter(u => u.role === "counter").length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No counter login found</p>
                              ) : (
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Username</p>
                                        <p className="font-medium">{systemUsers.find(u => u.role === "counter")?.username}</p>
                                      </div>
                                      <div className="border-l pl-4">
                                        <p className="text-xs text-muted-foreground">Password</p>
                                        <p className="font-mono text-sm">{systemUsers.find(u => u.role === "counter")?.password}</p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => { const user = systemUsers.find(u => u.role === "counter"); if (user) { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); } }}>
                                      <Pencil className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="border-t pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-sm">Staff Members (each has their own PIN)</h4>
                                <Button size="sm" variant="outline" onClick={() => { setStaffMemberFormData({ name: "", pin: "", roleType: "counter" }); setIsStaffMemberCreateOpen(true); }} data-testid="button-add-counter-staff">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Staff
                                </Button>
                              </div>
                              {counterStaffMembers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No staff members assigned to counter role</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Login PIN</TableHead>
                                      <TableHead className="text-center">Active</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {counterStaffMembers.map((member) => (
                                      <TableRow key={member.id}>
                                        <TableCell className="font-medium">{member.name}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            <span className="font-mono text-sm">
                                              {visibleStaffPins.has(member.id) ? member.pin : "•••••"}
                                            </span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleStaffPinVisibility(member.id)}>
                                              {visibleStaffPins.has(member.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            </Button>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            <Switch checked={member.active} onCheckedChange={() => toggleStaffMemberActive(member)} />
                                            <Badge variant={member.active ? "default" : "secondary"}>{member.active ? "Active" : "Inactive"}</Badge>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => { setEditStaffMember(member); setStaffMemberFormData({ name: member.name, pin: member.pin, roleType: "counter" }); }} data-testid={`button-edit-staff-${member.id}`}>
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remove staff member "${member.name}"?`)) { deleteStaffMemberMutation.mutate(member.id); } }} data-testid={`button-delete-staff-${member.id}`}>
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="section" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Section</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({systemUsers.filter(u => u.role === "section").length} login{systemUsers.filter(u => u.role === "section").length !== 1 ? "s" : ""}, {sectionStaffMembers.length} staff)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Login Details</h4>
                              {systemUsers.filter(u => u.role === "section").length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No section login found</p>
                              ) : (
                                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Username</p>
                                        <p className="font-medium">{systemUsers.find(u => u.role === "section")?.username}</p>
                                      </div>
                                      <div className="border-l pl-4">
                                        <p className="text-xs text-muted-foreground">Password</p>
                                        <p className="font-mono text-sm">{systemUsers.find(u => u.role === "section")?.password}</p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => { const user = systemUsers.find(u => u.role === "section"); if (user) { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); } }}>
                                      <Pencil className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="border-t pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-sm">Staff Members (each has their own PIN)</h4>
                                <Button size="sm" variant="outline" onClick={() => { setStaffMemberFormData({ name: "", pin: "", roleType: "section" }); setIsStaffMemberCreateOpen(true); }} data-testid="button-add-section-staff">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Staff
                                </Button>
                              </div>
                              {sectionStaffMembers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No staff members assigned to section role</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Login PIN</TableHead>
                                      <TableHead className="text-center">Active</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sectionStaffMembers.map((member) => (
                                      <TableRow key={member.id}>
                                        <TableCell className="font-medium">{member.name}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            <span className="font-mono text-sm">
                                              {visibleStaffPins.has(member.id) ? member.pin : "•••••"}
                                            </span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleStaffPinVisibility(member.id)}>
                                              {visibleStaffPins.has(member.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            </Button>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            <Switch checked={member.active} onCheckedChange={() => toggleStaffMemberActive(member)} />
                                            <Badge variant={member.active ? "default" : "secondary"}>{member.active ? "Active" : "Inactive"}</Badge>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => { setEditStaffMember(member); setStaffMemberFormData({ name: member.name, pin: member.pin, roleType: "section" }); }} data-testid={`button-edit-staff-${member.id}`}>
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remove staff member "${member.name}"?`)) { deleteStaffMemberMutation.mutate(member.id); } }} data-testid={`button-delete-staff-${member.id}`}>
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="driver" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Driver</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({systemUsers.filter(u => u.role === "driver").length} users)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {systemUsers.filter(u => u.role === "driver").length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No drivers found</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Username</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Password</TableHead>
                                  <TableHead>PIN</TableHead>
                                  <TableHead className="text-center">Active</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {systemUsers.filter(u => u.role === "driver").map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${isUserOnline(user.id) ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} title={isUserOnline(user.id) ? 'Online' : 'Offline'} />
                                        {user.username}
                                      </div>
                                    </TableCell>
                                    <TableCell>{user.name || "-"}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono text-sm">
                                          {visiblePasswords.has(user.id) ? user.password : "••••••"}
                                        </span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePasswordVisibility(user.id)}>
                                          {visiblePasswords.has(user.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono text-sm">
                                          {visiblePins.has(user.id) ? (user.pin || "-") : (user.pin ? "•••••" : "-")}
                                        </span>
                                        {user.pin && (
                                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePinVisibility(user.id)}>
                                            {visiblePins.has(user.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                          </Button>
                                        )}
                                      </div>
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
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto">
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
                const defaultRole = "counter";
                setUserFormData({ username: getNextUsername(defaultRole), password: "", name: "", email: "", role: defaultRole, pin: "" });
              }
              setIsUserCreateOpen(open);
            }}>
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Add User Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                  <SelectItem value="counter">Counter</SelectItem>
                  <SelectItem value="section">Section</SelectItem>
                  <SelectItem value="driver">Delivery Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Username (auto-generated)</Label>
              <Input
                placeholder="Username"
                value={userFormData.username}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, username: e.target.value })
                }
                className="bg-muted"
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
              <Label>PIN (5 digits)</Label>
              <Input
                type="password"
                placeholder="Enter 5-digit PIN"
                value={userFormData.pin}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, pin: e.target.value.replace(/\D/g, "").slice(0, 5) })
                }
                maxLength={5}
                data-testid="input-new-pin"
              />
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
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto">
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
                  <SelectItem value="counter">Counter</SelectItem>
                  <SelectItem value="section">Section</SelectItem>
                  <SelectItem value="driver">Delivery Driver</SelectItem>
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

      {/* Driver Delivery History Dialog */}
      <Dialog open={!!selectedDriverHistory} onOpenChange={() => setSelectedDriverHistory(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-600" />
              Delivery History - {selectedDriverHistory?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {orders?.filter(order => 
              order.delivered && order.deliveredByWorkerId === selectedDriverHistory?.id
            ).sort((a, b) => {
              const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
              const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
              return dateB - dateA;
            }).map((order) => (
              <Card key={order.id} className="p-3" data-testid={`card-driver-history-${order.id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">#{order.orderNumber}</div>
                    <div className="text-sm text-muted-foreground">{order.customerName || "Walk-in"}</div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500 text-white mb-1">Delivered</Badge>
                    {order.deliveryDate && (
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.deliveryDate), "dd MMM yyyy, h:mm a")}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {(!orders?.filter(order => 
              order.delivered && order.deliveredByWorkerId === selectedDriverHistory?.id
            ).length) && (
              <div className="text-center py-8 text-muted-foreground">
                No deliveries found for this driver
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Staff Member Dialog */}
      <Dialog open={isStaffMemberCreateOpen} onOpenChange={(open) => {
        setIsStaffMemberCreateOpen(open);
        if (!open) setStaffMemberFormData({ name: "", pin: "", roleType: "counter" });
      }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Staff member name"
                value={staffMemberFormData.name}
                onChange={(e) => setStaffMemberFormData({ ...staffMemberFormData, name: e.target.value })}
                data-testid="input-staff-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Key className="w-4 h-4" />
                PIN (5 digits)
              </Label>
              <Input
                type="tel"
                maxLength={5}
                placeholder="Enter 5-digit PIN"
                value={staffMemberFormData.pin}
                autoComplete="off"
                onChange={(e) => setStaffMemberFormData({ ...staffMemberFormData, pin: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                className="text-center tracking-widest"
                data-testid="input-staff-pin"
              />
              <p className="text-xs text-muted-foreground">Staff will use this PIN to identify themselves when taking actions</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={staffMemberFormData.roleType}
                onValueChange={(value: "counter" | "section") => setStaffMemberFormData({ ...staffMemberFormData, roleType: value })}
              >
                <SelectTrigger data-testid="select-staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counter">Counter</SelectItem>
                  <SelectItem value="section">Section</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateStaffMember}
              disabled={createStaffMemberMutation.isPending}
              data-testid="button-save-staff"
            >
              {createStaffMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Staff Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Member Dialog */}
      <Dialog open={!!editStaffMember} onOpenChange={(open) => {
        if (!open) {
          setEditStaffMember(null);
          setStaffMemberFormData({ name: "", pin: "", roleType: "counter" });
        }
      }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Staff member name"
                value={staffMemberFormData.name}
                onChange={(e) => setStaffMemberFormData({ ...staffMemberFormData, name: e.target.value })}
                data-testid="input-edit-staff-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Key className="w-4 h-4" />
                New PIN (leave blank to keep current)
              </Label>
              <Input
                type="tel"
                maxLength={5}
                placeholder="Enter new 5-digit PIN"
                value={staffMemberFormData.pin}
                autoComplete="off"
                onChange={(e) => setStaffMemberFormData({ ...staffMemberFormData, pin: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                className="text-center tracking-widest"
                data-testid="input-edit-staff-pin"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleUpdateStaffMember}
              disabled={updateStaffMemberMutation.isPending}
              data-testid="button-update-staff"
            >
              {updateStaffMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Staff Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
