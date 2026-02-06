import { useState, useMemo, useRef } from "react";
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
  Download,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  startOfYear,
  endOfYear,
  parseISO,
} from "date-fns";
import type { Order, Bill, Client } from "@shared/schema";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import SalesReports from "./SalesReports";

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
  const [statsSubTab, setStatsSubTab] = useState<"staff-stats" | "item-report">("staff-stats");
  const [dateFilter, setDateFilter] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
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
    roleType: "counter" as "counter" | "section" | "driver",
  });
  const [visibleStaffPins, setVisibleStaffPins] = useState<Set<number>>(new Set());
  const [selectedStaffOrders, setSelectedStaffOrders] = useState<{
    staffId: number;
    staffName: string;
    type: "created" | "tagged" | "packed" | "delivered" | "paid";
  } | null>(null);
  
  // Report tab state
  const [reportStartDate, setReportStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [itemReportDateFilter, setItemReportDateFilter] = useState("today");
  const [itemReportMonth, setItemReportMonth] = useState(new Date().getMonth());
  const [itemReportYear, setItemReportYear] = useState(new Date().getFullYear());
  const [itemReportCustomFrom, setItemReportCustomFrom] = useState("");
  const [itemReportCustomTo, setItemReportCustomTo] = useState("");
  const reportTableRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");
  
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

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
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

  const driverStaffMembers = useMemo(() => {
    return staffMembers?.filter(m => m.roleType === 'driver') || [];
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
      case "monthly":
        const monthDate = new Date(selectedYear, selectedMonth, 1);
        return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
      case "yearly":
        const yearDate = new Date(selectedYear, 0, 1);
        return { start: startOfYear(yearDate), end: endOfYear(yearDate) };
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

  const getItemReportDateRange = () => {
    const now = new Date();
    switch (itemReportDateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "week":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "monthly":
        const monthDate = new Date(itemReportYear, itemReportMonth, 1);
        return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
      case "yearly":
        const yearDate = new Date(itemReportYear, 0, 1);
        return { start: startOfYear(yearDate), end: endOfYear(yearDate) };
      case "custom":
        if (itemReportCustomFrom && itemReportCustomTo) {
          return {
            start: startOfDay(parseISO(itemReportCustomFrom)),
            end: endOfDay(parseISO(itemReportCustomTo)),
          };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      case "all":
      default:
        return { start: new Date(0), end: now };
    }
  };

  // All individual staff members (tracked by PIN) - universal tracking
  const allStaffMembers = useMemo(() => {
    return staffMembers || [];
  }, [staffMembers]);

  // Universal worker stats - all individual staff members tracked by PIN
  // Match by NAME instead of ID to avoid ID collision between users and staff_members tables
  const workerStats = useMemo(() => {
    if (!allStaffMembers.length || !orders) return [];
    const { start, end } = getDateRange();

    return allStaffMembers
      .map((worker) => {
        const workerName = worker.name?.toLowerCase() || '';
        
        // Orders created by this worker - match by name
        const createdOrders = orders.filter((o) => {
          const entryName = o.entryBy?.toLowerCase() || '';
          if (entryName !== workerName) return false;
          if (!o.entryDate) return false;
          try {
            const entryDate = new Date(o.entryDate);
            return entryDate >= start && entryDate <= end;
          } catch {
            return false;
          }
        });

        const taggedOrders = orders.filter((o) => {
          const tagName = o.tagBy?.toLowerCase() || '';
          if (tagName !== workerName) return false;
          if (!o.tagDate) return false;
          try {
            const tagDate = new Date(o.tagDate);
            return tagDate >= start && tagDate <= end;
          } catch {
            return false;
          }
        });

        const packedOrders = orders.filter((o) => {
          const packName = o.packingBy?.toLowerCase() || '';
          if (packName !== workerName) return false;
          if (!o.packingDate) return false;
          try {
            const packDate = new Date(o.packingDate);
            return packDate >= start && packDate <= end;
          } catch {
            return false;
          }
        });

        const deliveredOrders = orders.filter((o) => {
          const delName = o.deliveryBy?.toLowerCase() || '';
          if (delName !== workerName) return false;
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
            const billName = b.createdBy?.toLowerCase() || '';
            if (billName !== workerName) return false;
            if (!b.isPaid) return false; // Only count paid bills
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
          ordersCreated: createdOrders.length,
          taggedCount: taggedOrders.length,
          packedCount: packedOrders.length,
          deliveredCount: deliveredOrders.length,
          billsCreated: createdBills.length,
          billsTotal,
          totalTasks:
            createdOrders.length +
            taggedOrders.length +
            packedOrders.length +
            deliveredOrders.length +
            createdBills.length,
        };
      })
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }, [allStaffMembers, orders, bills, dateFilter, customFromDate, customToDate, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    return workerStats.reduce(
      (acc, s) => ({
        ordersCreated: acc.ordersCreated + s.ordersCreated,
        tagged: acc.tagged + s.taggedCount,
        packed: acc.packed + s.packedCount,
        delivered: acc.delivered + s.deliveredCount,
        billsPaid: acc.billsPaid + s.billsCreated,
        billsTotal: acc.billsTotal + s.billsTotal,
      }),
      { ordersCreated: 0, tagged: 0, packed: 0, delivered: 0, billsPaid: 0, billsTotal: 0 },
    );
  }, [workerStats]);

  const adminStats = useMemo(() => {
    if (!orders || !bills) return { 
      orders: [] as Order[], 
      ordersCreated: 0,
      billsPaid: 0, 
      billsTotal: 0,
      taggedOrders: [] as Order[],
      packedOrders: [] as Order[],
      deliveredOrders: [] as Order[],
    };
    const { start, end } = getDateRange();
    
    // Match by name "Admin" or "Administrator" (case insensitive) instead of checking for null IDs
    const isAdmin = (name: string | null | undefined) => {
      if (!name) return false;
      const lowerName = name.toLowerCase();
      return lowerName === 'admin' || lowerName === 'administrator';
    };
    
    // Orders created by admin (match by name)
    const adminOrders = orders.filter((o) => {
      if (!isAdmin(o.entryBy)) return false;
      if (!o.entryDate) return false;
      try {
        const entryDate = new Date(o.entryDate);
        return entryDate >= start && entryDate <= end;
      } catch {
        return false;
      }
    });
    
    // Paid bills by admin (match by name)
    const adminBills = bills.filter((b) => {
      if (!isAdmin(b.createdBy)) return false;
      if (!b.isPaid) return false; // Only count paid bills
      if (!b.billDate) return false;
      try {
        const billDate = new Date(b.billDate);
        return billDate >= start && billDate <= end;
      } catch {
        return false;
      }
    });
    
    // Tagged by admin (match by name)
    const taggedOrders = orders.filter((o) => {
      if (!isAdmin(o.tagBy)) return false;
      if (!o.tagDate) return false;
      try {
        const tagDateVal = new Date(o.tagDate);
        return tagDateVal >= start && tagDateVal <= end;
      } catch {
        return false;
      }
    });
    
    // Packed by admin (match by name)
    const packedOrders = orders.filter((o) => {
      if (!isAdmin(o.packingBy)) return false;
      if (!o.packingDate) return false;
      try {
        const packingDateVal = new Date(o.packingDate);
        return packingDateVal >= start && packingDateVal <= end;
      } catch {
        return false;
      }
    });
    
    // Delivered by admin (match by name)
    const deliveredOrders = orders.filter((o) => {
      if (!isAdmin(o.deliveryBy)) return false;
      if (!o.deliveryDate) return false;
      try {
        const deliveredDateVal = new Date(o.deliveryDate);
        return deliveredDateVal >= start && deliveredDateVal <= end;
      } catch {
        return false;
      }
    });
    
    const billsTotal = adminBills.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
    
    return {
      orders: adminOrders,
      ordersCreated: adminOrders.length,
      billsPaid: adminBills.length,
      billsTotal,
      taggedOrders,
      packedOrders,
      deliveredOrders,
    };
  }, [orders, bills, dateFilter, customFromDate, customToDate, selectedMonth, selectedYear]);

  const [expandedAdminOrders, setExpandedAdminOrders] = useState<Set<number>>(new Set());
  const [selectedItemReportOrder, setSelectedItemReportOrder] = useState<Order | null>(null);
  const [selectedAdminOrders, setSelectedAdminOrders] = useState<{ type: "created" | "tagged" | "packed" | "delivered" | "paid"; orders: Order[] } | null>(null);
  
  const getAdminDateRangeLabel = () => {
    const { start, end } = getDateRange();
    if (dateFilter === "today" || dateFilter === "yesterday") {
      return format(start, "MMMM d, yyyy");
    } else if (dateFilter === "monthly" || dateFilter === "month") {
      return format(start, "MMMM yyyy");
    } else if (dateFilter === "yearly") {
      return format(start, "yyyy");
    } else if (dateFilter === "all") {
      return "All Time";
    } else {
      return `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
    }
  };
  
  const getItemReportDateLabel = () => {
    const { start, end } = getItemReportDateRange();
    if (itemReportDateFilter === "today" || itemReportDateFilter === "yesterday") {
      return format(start, "MMMM d, yyyy");
    } else if (itemReportDateFilter === "monthly" || itemReportDateFilter === "month") {
      return format(start, "MMMM yyyy");
    } else if (itemReportDateFilter === "yearly") {
      return format(start, "yyyy");
    } else if (itemReportDateFilter === "all") {
      return "All Time";
    } else {
      return `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
    }
  };

  const getDateRangeLabel = () => {
    const { start, end } = getDateRange();
    return `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`;
  };

  const exportToExcel = () => {
    const { start, end } = getDateRange();
    let dateRangeStr = "";
    if (dateFilter === "today" || dateFilter === "yesterday") {
      dateRangeStr = format(start, "MMMM d, yyyy");
    } else if (dateFilter === "monthly" || dateFilter === "month") {
      dateRangeStr = format(start, "MMMM yyyy");
    } else if (dateFilter === "yearly") {
      dateRangeStr = format(start, "yyyy");
    } else if (dateFilter === "all") {
      dateRangeStr = "All Time";
    } else {
      dateRangeStr = `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
    }
    
    const headerRows = [
      ["Liquid Washes Laundry"],
      ["Staff Performance Report"],
      [`Report Period: ${dateRangeStr}`],
      [],
      ["Staff Name", "Created", "Tagged", "Packed", "Delivered", "Paid Bills", "Total Tasks"],
    ];
    
    const dataRows = filteredStats.map((s) => [
      s.worker.name,
      s.ordersCreated,
      s.taggedCount,
      s.packedCount,
      s.deliveredCount,
      s.billsCreated,
      s.totalTasks,
    ]);
    
    dataRows.push([
      "TOTAL",
      totals.ordersCreated,
      totals.tagged,
      totals.packed,
      totals.delivered,
      totals.billsPaid,
      totals.ordersCreated + totals.tagged + totals.packed + totals.delivered + totals.billsPaid,
    ]);
    
    const adminTotal = adminStats.ordersCreated + adminStats.taggedOrders.length + adminStats.packedOrders.length + 
                       adminStats.deliveredOrders.length + adminStats.billsPaid;
    
    const adminSection = [
      [],
      ["Admin Performance"],
      ["Activity", "Count"],
      ["Created Orders", adminStats.ordersCreated],
      ["Tagged", adminStats.taggedOrders.length],
      ["Packed", adminStats.packedOrders.length],
      ["Delivered", adminStats.deliveredOrders.length],
      ["Paid Bills", adminStats.billsPaid],
      ["TOTAL", adminTotal],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows, ...adminSection]);
    ws["!cols"] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Report");
    XLSX.writeFile(wb, `Staff_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel Downloaded", description: "Staff report saved" });
  };

  const exportToPDF = () => {
    const { start, end } = getDateRange();
    let dateRangeStr = "";
    if (dateFilter === "today" || dateFilter === "yesterday") {
      dateRangeStr = format(start, "MMMM d, yyyy");
    } else if (dateFilter === "monthly" || dateFilter === "month") {
      dateRangeStr = format(start, "MMMM yyyy");
    } else if (dateFilter === "yearly") {
      dateRangeStr = format(start, "yyyy");
    } else if (dateFilter === "all") {
      dateRangeStr = "All Time";
    } else {
      dateRangeStr = `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
    }
    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 148mm; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="font-size: 20px; font-weight: bold; color: #1e40af;">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 14px; margin-top: 5px; font-weight: bold;">Staff Performance Report</div>
          <div style="font-size: 11px; margin-top: 5px; color: #666;">${dateRangeStr}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: left;">Staff</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Created</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Tagged</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Packed</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Delivered</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Paid</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStats
              .map(
                (s) => `
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">${s.worker.name}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.ordersCreated}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.taggedCount}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.packedCount}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.deliveredCount}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.billsCreated}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${s.totalTasks}</td>
              </tr>
            `,
              )
              .join("")}
            <tr style="background: #e5e7eb; font-weight: bold;">
              <td style="padding: 8px 4px; border: 1px solid #ddd;">TOTAL</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.ordersCreated}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.tagged}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.packed}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.delivered}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.billsPaid}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.ordersCreated + totals.tagged + totals.packed + totals.delivered + totals.billsPaid}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 20px;">
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 10px; color: #1e40af;">Admin Performance</div>
          <table style="width: 50%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: left;">Activity</th>
                <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">Created Orders</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${adminStats.ordersCreated}</td>
              </tr>
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">Tagged</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${adminStats.taggedOrders.length}</td>
              </tr>
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">Packed</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${adminStats.packedOrders.length}</td>
              </tr>
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">Delivered</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${adminStats.deliveredOrders.length}</td>
              </tr>
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">Paid Bills</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${adminStats.billsPaid}</td>
              </tr>
              <tr style="background: #e5e7eb; font-weight: bold;">
                <td style="padding: 8px 4px; border: 1px solid #ddd;">TOTAL</td>
                <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${adminStats.ordersCreated + adminStats.taggedOrders.length + adminStats.packedOrders.length + adminStats.deliveredOrders.length + adminStats.billsPaid}</td>
              </tr>
            </tbody>
          </table>
        </div>

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

  // Get orders for a specific staff member by type
  const getStaffOrders = (staffId: number, type: "created" | "tagged" | "packed" | "delivered" | "paid") => {
    if (!orders) return [];
    const { start, end } = getDateRange();
    
    // "paid" type returns paid bills by this staff member
    if (type === "paid") {
      return bills?.filter(b => {
        if (b.createdByWorkerId !== staffId) return false;
        if (!b.isPaid) return false; // Only paid bills
        if (!b.billDate) return false;
        const billDate = new Date(b.billDate);
        return billDate >= start && billDate <= end;
      }) || [];
    }
    
    return orders.filter((o) => {
      let dateField: string | Date | null | undefined;
      let workerField: number | null | undefined;
      
      if (type === "created") {
        dateField = o.entryDate;
        workerField = o.entryByWorkerId;
      } else if (type === "tagged") {
        dateField = o.tagDate;
        workerField = o.tagWorkerId;
      } else if (type === "packed") {
        dateField = o.packingDate;
        workerField = o.packingWorkerId;
      } else if (type === "delivered") {
        dateField = o.deliveryDate;
        workerField = o.deliveredByWorkerId;
      }
      
      if (workerField !== staffId || !dateField) return false;
      const date = new Date(dateField);
      return date >= start && date <= end;
    });
  };

  // Generate staff PDF report with summary statistics
  const generateStaffPDF = (staff: { 
    name: string; 
    createdCount: number; 
    taggedCount: number; 
    packedCount: number;
    deliveredCount: number;
  }) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let startY = 15;
    
    if (logoBase64) {
      const logoWidth = 40;
      const logoHeight = 30;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(logoBase64, "PNG", logoX, startY, logoWidth, logoHeight);
      startY += logoHeight + 5;
    }
    
    doc.setFontSize(18);
    doc.text("Staff Performance Report", pageWidth / 2, startY + 5, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(`Staff: ${staff.name}`, pageWidth / 2, startY + 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, startY + 23, { align: "center" });
    
    doc.setFontSize(12);
    doc.text("Performance Summary", 14, startY + 40);
    
    const summaryData = [
      ["Billed Orders", staff.createdCount.toString()],
      ["Orders Tagged", staff.taggedCount.toString()],
      ["Orders Packed", staff.packedCount.toString()],
      ["Orders Delivered", staff.deliveredCount.toString()],
      ["Total Actions", (staff.createdCount + staff.taggedCount + staff.packedCount + staff.deliveredCount).toString()],
    ];
    
    autoTable(doc, {
      startY: startY + 45,
      head: [["Activity", "Count"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 11 },
    });
    
    doc.save(`Staff_Report_${staff.name}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({
      title: "PDF Downloaded",
      description: `Staff report for ${staff.name} exported to PDF`,
    });
  };

  const generateItemReportExcel = (filteredOrders: Order[]) => {
    const { start, end } = getItemReportDateRange();
    let dateRangeStr = "";
    if (itemReportDateFilter === "today" || itemReportDateFilter === "yesterday") {
      dateRangeStr = format(start, "MMMM d, yyyy");
    } else if (itemReportDateFilter === "monthly" || itemReportDateFilter === "month") {
      dateRangeStr = format(start, "MMMM yyyy");
    } else if (itemReportDateFilter === "yearly") {
      dateRangeStr = format(start, "yyyy");
    } else if (itemReportDateFilter === "all") {
      dateRangeStr = "All Time";
    } else {
      dateRangeStr = `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
    }
    
    const wsData: (string | number)[][] = [];
    wsData.push(["Liquid Washes Laundry"]);
    wsData.push(["Item Quantity Report"]);
    wsData.push([`Report Period: ${dateRangeStr}`]);
    wsData.push([]);
    wsData.push(["Order Number", "Client Name", "Order Date", "Item", "Qty"]);

    let totalItemsCount = 0;
    filteredOrders.forEach((order) => {
      const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in";
      const orderDate = order.entryDate ? format(new Date(order.entryDate), "MMMM d, yyyy") : "";
      const itemsStr = order.items || "";
      
      // Parse items and create a row for each item
      const itemRegex = /(\d+)x\s+([^,\[\]]+?)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?(?:,|$)/g;
      let match;
      let isFirstItem = true;
      while ((match = itemRegex.exec(itemsStr)) !== null) {
        const qty = parseInt(match[1], 10);
        const itemName = match[2].trim();
        totalItemsCount += qty;
        
        // First item shows order details, subsequent items show empty for order columns
        if (isFirstItem) {
          wsData.push([order.orderNumber || "", clientName, orderDate, itemName, qty]);
          isFirstItem = false;
        } else {
          wsData.push(["", "", "", itemName, qty]);
        }
      }
      
      // If no items parsed, still show the order with the raw items string
      if (isFirstItem) {
        wsData.push([order.orderNumber || "", clientName, orderDate, itemsStr || "No items", 0]);
      }
    });

    wsData.push([]);
    wsData.push(["Total Orders:", filteredOrders.length, "", "Total Items:", totalItemsCount]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 30 },
      { wch: 8 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Report");
    XLSX.writeFile(wb, `Item_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({
      title: "Excel Downloaded",
      description: "Item report exported to Excel",
    });
  };

  const exportItemReportToPDF = (filteredOrders: Order[]) => {
    const { start, end } = getItemReportDateRange();
    let dateRangeStr = "";
    if (itemReportDateFilter === "today" || itemReportDateFilter === "yesterday") {
      dateRangeStr = format(start, "MMMM d, yyyy");
    } else if (itemReportDateFilter === "monthly" || itemReportDateFilter === "month") {
      dateRangeStr = format(start, "MMMM yyyy");
    } else if (itemReportDateFilter === "yearly") {
      dateRangeStr = format(start, "yyyy");
    } else if (itemReportDateFilter === "all") {
      dateRangeStr = "All Time";
    } else {
      dateRangeStr = `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
    }
    
    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="font-size: 20px; font-weight: bold; color: #1e40af;">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 14px; margin-top: 5px; font-weight: bold;">Item Quantity Report</div>
          <div style="font-size: 11px; margin-top: 5px; color: #666;">${dateRangeStr}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 6px 4px; border: 1px solid #ddd; text-align: left;">Order #</th>
              <th style="padding: 6px 4px; border: 1px solid #ddd; text-align: left;">Client</th>
              <th style="padding: 6px 4px; border: 1px solid #ddd; text-align: left;">Date</th>
              <th style="padding: 6px 4px; border: 1px solid #ddd; text-align: left;">Items</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map((order) => {
              const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in";
              const orderDate = order.entryDate ? format(new Date(order.entryDate), "MMM d, yyyy") : "";
              return `
                <tr>
                  <td style="padding: 4px; border: 1px solid #ddd;">${order.orderNumber || ""}</td>
                  <td style="padding: 4px; border: 1px solid #ddd;">${clientName}</td>
                  <td style="padding: 4px; border: 1px solid #ddd;">${orderDate}</td>
                  <td style="padding: 4px; border: 1px solid #ddd; font-size: 8px;">${order.items || ""}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div style="text-align: right; font-weight: bold; margin-bottom: 15px;">
          Total Orders: ${filteredOrders.length}
        </div>

        <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #888;">
          Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")} | Tel: 026 815 824 | Mobile: +971 56 338 0001
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `Item_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "landscape" as const,
      },
    };

    html2pdf().set(opt).from(content).save();
    toast({
      title: "PDF Downloaded",
      description: "Item report exported to PDF",
    });
  };

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
            Management
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
              <TabsTrigger value="sales-reports" data-testid="tab-sales-reports">
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Sales Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="space-y-4">
                {/* Sub-tabs for User Stats */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={statsSubTab === "staff-stats" ? "default" : "outline"}
                    onClick={() => setStatsSubTab("staff-stats")}
                    data-testid="button-staff-stats-tab"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Staff Stats
                  </Button>
                  <Button
                    variant={statsSubTab === "item-report" ? "default" : "outline"}
                    onClick={() => setStatsSubTab("item-report")}
                    data-testid="button-item-report-tab"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Item Report
                  </Button>
                </div>

                {statsSubTab === "staff-stats" && (
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
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {dateFilter === "monthly" && (
                    <div className="flex items-center gap-2">
                      <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                        <SelectTrigger className="w-32" data-testid="select-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">January</SelectItem>
                          <SelectItem value="1">February</SelectItem>
                          <SelectItem value="2">March</SelectItem>
                          <SelectItem value="3">April</SelectItem>
                          <SelectItem value="4">May</SelectItem>
                          <SelectItem value="5">June</SelectItem>
                          <SelectItem value="6">July</SelectItem>
                          <SelectItem value="7">August</SelectItem>
                          <SelectItem value="8">September</SelectItem>
                          <SelectItem value="9">October</SelectItem>
                          <SelectItem value="10">November</SelectItem>
                          <SelectItem value="11">December</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-24" data-testid="select-year-monthly">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {dateFilter === "yearly" && (
                    <div className="flex items-center gap-2">
                      <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-24" data-testid="select-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                            Tagged
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
                            Packed
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
                            Delivered
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
                            {totals.billsPaid}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Billed Orders ({totals.billsTotal.toFixed(0)} AED)
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
                              totals.billsPaid}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Tasks
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Admin Performance */}
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      Admin Performance
                      <Badge variant="outline" className="ml-2">
                        {getAdminDateRangeLabel()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="text-center">Role</TableHead>
                            <TableHead className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <FileText className="w-4 h-4 text-blue-500" />
                                Created
                              </div>
                            </TableHead>
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
                                Paid
                              </div>
                            </TableHead>
                            <TableHead className="text-center">Total</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow data-testid="row-admin-stats">
                            <TableCell className="font-medium">Admin</TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className="bg-purple-500/10 text-purple-600 border-purple-500/30"
                              >
                                Admin
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                onClick={() => adminStats.ordersCreated > 0 && setSelectedAdminOrders({ type: "created", orders: adminStats.orders })}
                                data-testid="badge-admin-created"
                              >
                                {adminStats.ordersCreated}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                onClick={() => adminStats.taggedOrders.length > 0 && setSelectedAdminOrders({ type: "tagged", orders: adminStats.taggedOrders })}
                                data-testid="badge-admin-tagged"
                              >
                                {adminStats.taggedOrders.length}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40"
                                onClick={() => adminStats.packedOrders.length > 0 && setSelectedAdminOrders({ type: "packed", orders: adminStats.packedOrders })}
                                data-testid="badge-admin-packed"
                              >
                                {adminStats.packedOrders.length}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40"
                                onClick={() => adminStats.deliveredOrders.length > 0 && setSelectedAdminOrders({ type: "delivered", orders: adminStats.deliveredOrders })}
                                data-testid="badge-admin-delivered"
                              >
                                {adminStats.deliveredOrders.length}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                                onClick={() => adminStats.billsPaid > 0 && setSelectedAdminOrders({ type: "paid", orders: adminStats.orders })}
                                data-testid="badge-admin-paid"
                              >
                                {adminStats.billsPaid}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {adminStats.ordersCreated + adminStats.taggedOrders.length + adminStats.packedOrders.length + adminStats.deliveredOrders.length + adminStats.billsPaid}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                                Active
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Admin Orders Popup Dialog */}
                <Dialog open={!!selectedAdminOrders} onOpenChange={(open) => !open && setSelectedAdminOrders(null)}>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {selectedAdminOrders?.type === "created" && <FileText className="w-5 h-5 text-blue-500" />}
                        {selectedAdminOrders?.type === "tagged" && <Tag className="w-5 h-5 text-orange-500" />}
                        {selectedAdminOrders?.type === "packed" && <Package className="w-5 h-5 text-green-500" />}
                        {selectedAdminOrders?.type === "delivered" && <Truck className="w-5 h-5 text-purple-500" />}
                        {selectedAdminOrders?.type === "paid" && <Receipt className="w-5 h-5 text-cyan-500" />}
                        Admin - {selectedAdminOrders?.type === "created" ? "Orders Created" : 
                                 selectedAdminOrders?.type === "tagged" ? "Orders Tagged" :
                                 selectedAdminOrders?.type === "packed" ? "Orders Packed" : 
                                 selectedAdminOrders?.type === "delivered" ? "Orders Delivered" : "Paid Bills"}
                        <Badge variant="outline" className="ml-2">{selectedAdminOrders?.orders.length || 0}</Badge>
                      </DialogTitle>
                    </DialogHeader>
                    {selectedAdminOrders && (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order #</TableHead>
                              <TableHead>Client</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Items</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedAdminOrders.orders.map((order) => {
                              const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in";
                              return (
                                <TableRow key={order.id} data-testid={`row-admin-popup-order-${order.id}`}>
                                  <TableCell className="font-medium text-blue-600">
                                    {order.orderNumber}
                                  </TableCell>
                                  <TableCell>{clientName}</TableCell>
                                  <TableCell>
                                    {order.entryDate && format(new Date(order.entryDate), "MMM d, yyyy")}
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                                    {order.items || "No items"}
                                  </TableCell>
                                  <TableCell className="text-right">{order.finalAmount} AED</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Universal Staff Stats Table - All staff tracked by PIN */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      All Staff Performance
                      <Badge variant="outline" className="ml-2">
                        {filteredStats.length} staff
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      All staff are all-rounders - tracked by PIN across all activities
                    </p>
                  </CardHeader>
                  <CardContent>
                    {filteredStats.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No staff members found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Staff Name</TableHead>
                              <TableHead className="text-center">Role</TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <FileText className="w-4 h-4 text-blue-500" />
                                  Created
                                </div>
                              </TableHead>
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
                                  Paid
                                </div>
                              </TableHead>
                              <TableHead className="text-center">Total</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="text-center">PDF</TableHead>
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
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      s.worker.roleType === "counter" 
                                        ? "bg-blue-500/10 text-blue-600 border-blue-500/30" 
                                        : s.worker.roleType === "section" 
                                          ? "bg-purple-500/10 text-purple-600 border-purple-500/30" 
                                          : "bg-green-500/10 text-green-600 border-green-500/30"
                                    }
                                  >
                                    {s.worker.roleType === "counter" ? "Counter" : s.worker.roleType === "section" ? "Section" : "Driver"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                    onClick={() => s.ordersCreated > 0 && setSelectedStaffOrders({ staffId: s.worker.id, staffName: s.worker.name, type: "created" })}
                                    data-testid={`badge-created-${s.worker.id}`}
                                  >
                                    {s.ordersCreated}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                    onClick={() => s.taggedCount > 0 && setSelectedStaffOrders({ staffId: s.worker.id, staffName: s.worker.name, type: "tagged" })}
                                    data-testid={`badge-tagged-${s.worker.id}`}
                                  >
                                    {s.taggedCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40"
                                    onClick={() => s.packedCount > 0 && setSelectedStaffOrders({ staffId: s.worker.id, staffName: s.worker.name, type: "packed" })}
                                    data-testid={`badge-packed-${s.worker.id}`}
                                  >
                                    {s.packedCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40"
                                    onClick={() => s.deliveredCount > 0 && setSelectedStaffOrders({ staffId: s.worker.id, staffName: s.worker.name, type: "delivered" })}
                                    data-testid={`badge-delivered-${s.worker.id}`}
                                  >
                                    {s.deliveredCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                                    onClick={() => s.billsCreated > 0 && setSelectedStaffOrders({ staffId: s.worker.id, staffName: s.worker.name, type: "paid" })}
                                    data-testid={`badge-paid-${s.worker.id}`}
                                  >
                                    {s.billsCreated}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold">
                                  {s.totalTasks}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={s.worker.active ? "default" : "secondary"}>
                                    {s.worker.active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generateStaffPDF({
                                      name: s.worker.name,
                                      createdCount: s.billsCreated,
                                      taggedCount: s.taggedCount,
                                      packedCount: s.packedCount,
                                      deliveredCount: s.deliveredCount
                                    })}
                                    data-testid={`button-pdf-${s.worker.id}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
                )}

                {statsSubTab === "item-report" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Item Quantity Report
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-3 mb-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <Select value={itemReportDateFilter} onValueChange={setItemReportDateFilter}>
                            <SelectTrigger className="w-36" data-testid="select-item-report-date-filter">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="yesterday">Yesterday</SelectItem>
                              <SelectItem value="week">This Week</SelectItem>
                              <SelectItem value="month">This Month</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                              <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {itemReportDateFilter === "monthly" && (
                          <div className="flex items-center gap-2">
                            <Select value={itemReportMonth.toString()} onValueChange={(v) => setItemReportMonth(parseInt(v))}>
                              <SelectTrigger className="w-32" data-testid="select-item-report-month">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">January</SelectItem>
                                <SelectItem value="1">February</SelectItem>
                                <SelectItem value="2">March</SelectItem>
                                <SelectItem value="3">April</SelectItem>
                                <SelectItem value="4">May</SelectItem>
                                <SelectItem value="5">June</SelectItem>
                                <SelectItem value="6">July</SelectItem>
                                <SelectItem value="7">August</SelectItem>
                                <SelectItem value="8">September</SelectItem>
                                <SelectItem value="9">October</SelectItem>
                                <SelectItem value="10">November</SelectItem>
                                <SelectItem value="11">December</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={itemReportYear.toString()} onValueChange={(v) => setItemReportYear(parseInt(v))}>
                              <SelectTrigger className="w-24" data-testid="select-item-report-year-monthly">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {itemReportDateFilter === "yearly" && (
                          <div className="flex items-center gap-2">
                            <Select value={itemReportYear.toString()} onValueChange={(v) => setItemReportYear(parseInt(v))}>
                              <SelectTrigger className="w-24" data-testid="select-item-report-year">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {itemReportDateFilter === "custom" && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={itemReportCustomFrom}
                              onChange={(e) => setItemReportCustomFrom(e.target.value)}
                              className="w-36"
                              data-testid="input-item-report-from-date"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                              type="date"
                              value={itemReportCustomTo}
                              onChange={(e) => setItemReportCustomTo(e.target.value)}
                              className="w-36"
                              data-testid="input-item-report-to-date"
                            />
                          </div>
                        )}
                      </div>

                      {(() => {
                        const { start: startDate, end: endDate } = getItemReportDateRange();

                        const filteredOrders = orders?.filter((order) => {
                          const orderDate = new Date(order.entryDate);
                          return orderDate >= startDate && orderDate <= endDate;
                        }) || [];

                        if (filteredOrders.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                              <Package className="w-12 h-12 mb-4 opacity-50" />
                              <p>No orders found in the selected date range</p>
                            </div>
                          );
                        }

                        // Calculate total items across all orders
                        let totalItems = 0;
                        filteredOrders.forEach((order) => {
                          const itemsStr = order.items || "";
                          const itemRegex = /(\d+)x\s+([^,\[\]]+?)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?(?:,|$)/g;
                          let match;
                          while ((match = itemRegex.exec(itemsStr)) !== null) {
                            totalItems += parseInt(match[1], 10);
                          }
                        });

                        return (
                          <>
                            <div className="flex items-center justify-between mb-4">
                              <Badge variant="outline" className="text-sm">
                                {getItemReportDateLabel()}
                              </Badge>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => generateItemReportExcel(filteredOrders)}
                                  data-testid="button-export-excel"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Excel
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => exportItemReportToPDF(filteredOrders)}
                                  data-testid="button-export-pdf"
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  Export PDF
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                  <ClipboardList className="w-4 h-4 text-blue-500" />
                                  <span className="text-sm text-muted-foreground">Total Orders</span>
                                </div>
                                <p className="text-2xl font-bold">{filteredOrders.length}</p>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                  <Package className="w-4 h-4 text-green-500" />
                                  <span className="text-sm text-muted-foreground">Total Items</span>
                                </div>
                                <p className="text-2xl font-bold">{totalItems}</p>
                              </div>
                            </div>
                            
                            <div ref={reportTableRef} className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Items</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredOrders.map((order) => {
                                    const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in";
                                    
                                    // Count items in this order
                                    let orderItemCount = 0;
                                    const itemsStr = order.items || "";
                                    const itemRegex = /(\d+)x\s+([^,\[\]]+?)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?(?:,|$)/g;
                                    let match;
                                    while ((match = itemRegex.exec(itemsStr)) !== null) {
                                      orderItemCount += parseInt(match[1], 10);
                                    }
                                    
                                    return (
                                      <TableRow 
                                        key={order.id}
                                        className="cursor-pointer hover-elevate"
                                        onClick={() => setSelectedItemReportOrder(order)}
                                        data-testid={`row-item-report-order-${order.id}`}
                                      >
                                        <TableCell className="font-medium text-blue-600">
                                          {order.orderNumber}
                                        </TableCell>
                                        <TableCell>{clientName}</TableCell>
                                        <TableCell>
                                          {order.entryDate && format(new Date(order.entryDate), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right">{orderItemCount} items</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}
                
                {/* Item Report Order Details Dialog */}
                <Dialog open={!!selectedItemReportOrder} onOpenChange={(open) => !open && setSelectedItemReportOrder(null)}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Order {selectedItemReportOrder?.orderNumber}
                      </DialogTitle>
                    </DialogHeader>
                    {selectedItemReportOrder && (() => {
                      const order = selectedItemReportOrder;
                      const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in";
                      const itemsStr = order.items || "";
                      const itemRegex = /(\d+)x\s+([^,\[\]]+?)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?(?:,|$)/g;
                      const parsedItems: { qty: number; name: string }[] = [];
                      let match;
                      while ((match = itemRegex.exec(itemsStr)) !== null) {
                        parsedItems.push({ qty: parseInt(match[1], 10), name: match[2].trim() });
                      }
                      const totalItems = parsedItems.reduce((sum, item) => sum + item.qty, 0);
                      
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Client:</span>
                              <span className="ml-2 font-medium">{clientName}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date:</span>
                              <span className="ml-2 font-medium">
                                {order.entryDate && format(new Date(order.entryDate), "MMMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                          
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead className="text-right w-24">Quantity</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {parsedItems.length > 0 ? (
                                  parsedItems.map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{item.name}</TableCell>
                                      <TableCell className="text-right">{item.qty}</TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                                      No items found
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="bg-muted/50 font-bold">
                                  <TableCell>Total</TableCell>
                                  <TableCell className="text-right">{totalItems}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })()}
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <Key className="w-4 h-4 inline mr-1" />
                  <strong>All staff PINs work universally</strong> - Any staff member's PIN can be used for billing, tracking, and other functions across the entire system.
                </p>
              </div>
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
                              ({systemUsers.filter(u => u.role === "counter" || u.role === "reception").length} login{systemUsers.filter(u => u.role === "counter" || u.role === "reception").length !== 1 ? "s" : ""}, {counterStaffMembers.length} staff)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Login Details</h4>
                              {systemUsers.filter(u => u.role === "counter" || u.role === "reception").length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No counter login found</p>
                              ) : (
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Username</p>
                                        <p className="font-medium">{systemUsers.find(u => u.role === "counter" || u.role === "reception")?.username}</p>
                                      </div>
                                      <div className="border-l pl-4">
                                        <p className="text-xs text-muted-foreground">Password</p>
                                        <p className="font-mono text-sm">{systemUsers.find(u => u.role === "counter" || u.role === "reception")?.password}</p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => { const user = systemUsers.find(u => u.role === "counter" || u.role === "reception"); if (user) { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); } }}>
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
                              ({systemUsers.filter(u => u.role === "section" || u.role === "staff").length} login{systemUsers.filter(u => u.role === "section" || u.role === "staff").length !== 1 ? "s" : ""}, {sectionStaffMembers.length} staff)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Login Details</h4>
                              {systemUsers.filter(u => u.role === "section" || u.role === "staff").length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No section login found</p>
                              ) : (
                                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Username</p>
                                        <p className="font-medium">{systemUsers.find(u => u.role === "section" || u.role === "staff")?.username}</p>
                                      </div>
                                      <div className="border-l pl-4">
                                        <p className="text-xs text-muted-foreground">Password</p>
                                        <p className="font-mono text-sm">{systemUsers.find(u => u.role === "section" || u.role === "staff")?.password}</p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => { const user = systemUsers.find(u => u.role === "section" || u.role === "staff"); if (user) { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); } }}>
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
                              ({systemUsers.filter(u => u.role === "driver").length} login{systemUsers.filter(u => u.role === "driver").length !== 1 ? "s" : ""}, {driverStaffMembers.length} staff)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Login Details</h4>
                              {systemUsers.filter(u => u.role === "driver").length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No driver login found</p>
                              ) : (
                                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Username</p>
                                        <p className="font-medium">{systemUsers.find(u => u.role === "driver")?.username}</p>
                                      </div>
                                      <div className="border-l pl-4">
                                        <p className="text-xs text-muted-foreground">Password</p>
                                        <p className="font-mono text-sm">{systemUsers.find(u => u.role === "driver")?.password}</p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => { const user = systemUsers.find(u => u.role === "driver"); if (user) { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); } }}>
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
                                <Button size="sm" variant="outline" onClick={() => { setStaffMemberFormData({ name: "", pin: "", roleType: "driver" }); setIsStaffMemberCreateOpen(true); }} data-testid="button-add-driver-staff">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Staff
                                </Button>
                              </div>
                              {driverStaffMembers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No staff members assigned to driver role</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>PIN</TableHead>
                                      <TableHead className="text-center">Deliveries</TableHead>
                                      <TableHead className="text-center">Active</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {driverStaffMembers.map((member) => {
                                      const memberDeliveries = orders?.filter(o => o.delivered && (o.deliveredByWorkerId === member.id || o.deliveryBy === member.name)) || [];
                                      return (
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
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedDriverHistory({ id: member.id, name: member.name })}
                                            data-testid={`button-view-deliveries-${member.id}`}
                                          >
                                            <Truck className="w-3 h-3 mr-1" />
                                            {memberDeliveries.length}
                                          </Button>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            <Switch checked={member.active} onCheckedChange={() => toggleStaffMemberActive(member)} />
                                            <Badge variant={member.active ? "default" : "secondary"}>{member.active ? "Active" : "Inactive"}</Badge>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => { setEditStaffMember(member); setStaffMemberFormData({ name: member.name, pin: member.pin, roleType: "driver" }); }} data-testid={`button-edit-driver-staff-${member.id}`}>
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remove staff member "${member.name}"?`)) { deleteStaffMemberMutation.mutate(member.id); } }} data-testid={`button-delete-driver-staff-${member.id}`}>
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales-reports">
              <SalesReports embedded />
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
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-600" />
              Orders Delivered
              {(() => {
                const dId = selectedDriverHistory?.id;
                const dName = selectedDriverHistory?.name;
                const count = orders?.filter(order => 
                  order.delivered && (order.deliveredByWorkerId === dId || order.deliveryBy === dName)
                ).length || 0;
                return <Badge variant="outline" className="ml-1">{count}</Badge>;
              })()}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Delivered by: {selectedDriverHistory?.name}
            </p>
          </DialogHeader>
          {(() => {
            const driverId = selectedDriverHistory?.id;
            const driverName = selectedDriverHistory?.name;
            const deliveredOrders = orders?.filter(order => 
              order.delivered && (
                order.deliveredByWorkerId === driverId || 
                order.deliveryBy === driverName
              )
            ).sort((a, b) => {
              const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
              const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
              return dateB - dateA;
            }) || [];
            
            if (deliveredOrders.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  No deliveries found for this driver
                </div>
              );
            }
            
            return (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveredOrders.map((order) => {
                      const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "-";
                      return (
                        <TableRow key={order.id} data-testid={`row-driver-delivery-${order.id}`}>
                          <TableCell className="font-medium text-blue-600">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>{clientName}</TableCell>
                          <TableCell>
                            {order.deliveryDate ? format(new Date(order.deliveryDate), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                            {order.items || "No items"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {order.finalAmount || order.totalAmount || "0"} AED
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Staff Orders Dialog */}
      <Dialog open={!!selectedStaffOrders} onOpenChange={() => setSelectedStaffOrders(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedStaffOrders?.type === "created" && <FileText className="w-5 h-5 text-blue-500" />}
              {selectedStaffOrders?.type === "tagged" && <Tag className="w-5 h-5 text-orange-500" />}
              {selectedStaffOrders?.type === "packed" && <Package className="w-5 h-5 text-green-500" />}
              {selectedStaffOrders?.type === "delivered" && <Truck className="w-5 h-5 text-purple-500" />}
              {selectedStaffOrders?.type === "paid" && <Receipt className="w-5 h-5 text-cyan-500" />}
              {selectedStaffOrders?.staffName} - {selectedStaffOrders?.type === "created" ? "Orders Created" : 
               selectedStaffOrders?.type === "tagged" ? "Orders Tagged" : 
               selectedStaffOrders?.type === "packed" ? "Orders Packed" : 
               selectedStaffOrders?.type === "delivered" ? "Orders Delivered" : "Paid Bills"}
              <Badge variant="outline" className="ml-2">
                {selectedStaffOrders?.type === "paid" 
                  ? getStaffOrders(selectedStaffOrders?.staffId || 0, "paid").length
                  : (getStaffOrders(selectedStaffOrders?.staffId || 0, selectedStaffOrders?.type || "tagged") as Order[]).length}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedStaffOrders && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStaffOrders.type === "paid" ? (
                    // Show paid bills
                    getStaffOrders(selectedStaffOrders.staffId, "paid").map((bill: any) => {
                      const order = orders?.find(o => o.billId === bill.id);
                      const clientName = order ? (clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in") : "N/A";
                      return (
                        <TableRow key={bill.id} data-testid={`row-staff-bill-${bill.id}`}>
                          <TableCell className="font-medium text-blue-600">
                            {order?.orderNumber || `Bill #${bill.id}`}
                          </TableCell>
                          <TableCell>{clientName}</TableCell>
                          <TableCell>
                            {bill.billDate && format(new Date(bill.billDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                            {order?.items || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">{bill.amount} AED</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    // Show orders (created, tagged, packed, delivered)
                    (getStaffOrders(selectedStaffOrders.staffId, selectedStaffOrders.type) as Order[]).map((order) => {
                      const clientName = clients?.find(c => c.id === order.clientId)?.name || order.customerName || "Walk-in";
                      return (
                        <TableRow key={order.id} data-testid={`row-staff-order-${order.id}`}>
                          <TableCell className="font-medium text-blue-600">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>{clientName}</TableCell>
                          <TableCell>
                            {selectedStaffOrders.type === "created" && order.entryDate && format(new Date(order.entryDate), "MMM d, yyyy")}
                            {selectedStaffOrders.type === "tagged" && order.tagDate && format(new Date(order.tagDate), "MMM d, yyyy")}
                            {selectedStaffOrders.type === "packed" && order.packingDate && format(new Date(order.packingDate), "MMM d, yyyy")}
                            {selectedStaffOrders.type === "delivered" && order.deliveryDate && format(new Date(order.deliveryDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                            {order.items || "No items"}
                          </TableCell>
                          <TableCell className="text-right">{order.finalAmount} AED</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {selectedStaffOrders.type === "paid" && getStaffOrders(selectedStaffOrders.staffId, "paid").length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No paid bills found for this staff member
                      </TableCell>
                    </TableRow>
                  )}
                  {selectedStaffOrders.type !== "paid" && (getStaffOrders(selectedStaffOrders.staffId, selectedStaffOrders.type) as Order[]).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No orders found for this staff member
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
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
                onValueChange={(value: "counter" | "section" | "driver") => setStaffMemberFormData({ ...staffMemberFormData, roleType: value })}
              >
                <SelectTrigger data-testid="select-staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counter">Counter</SelectItem>
                  <SelectItem value="section">Section</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
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
