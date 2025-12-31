import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, TrendingUp, Wallet, Receipt, FileText, CalendarDays, CalendarRange } from "lucide-react";
import type { ClientTransaction } from "@shared/schema";

export default function SalesReports() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear().toString();
  
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("daily");

  const { data: allClients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: allTransactions, isLoading } = useQuery<{ clientId: number; transactions: ClientTransaction[] }[]>({
    queryKey: ["/api/sales-data", activeTab, selectedDate, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!allClients || allClients.length === 0) return [];
      const results = await Promise.all(
        allClients.map(async (client) => {
          const res = await fetch(`/api/clients/${client.id}/transactions`);
          const transactions = await res.json();
          return { clientId: client.id, clientName: client.name, clientPhone: client.phone, transactions };
        })
      );
      return results;
    },
    enabled: !!allClients && allClients.length > 0,
  });

  const filterTransactions = (period: 'daily' | 'monthly' | 'yearly') => {
    if (!allTransactions || !allClients) return { bills: [], deposits: [], totalBills: 0, totalDeposits: 0 };
    
    const bills: any[] = [];
    const deposits: any[] = [];
    
    allTransactions.forEach((clientData: any) => {
      const client = allClients.find(c => c.id === clientData.clientId);
      if (!client) return;
      
      clientData.transactions.forEach((tx: ClientTransaction) => {
        const txDate = new Date(tx.date);
        let matches = false;
        
        if (period === 'daily') {
          const selectedDateObj = new Date(selectedDate);
          selectedDateObj.setHours(0, 0, 0, 0);
          const txDateNorm = new Date(txDate);
          txDateNorm.setHours(0, 0, 0, 0);
          matches = txDateNorm.getTime() === selectedDateObj.getTime();
        } else if (period === 'monthly') {
          const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
          matches = txMonth === selectedMonth;
        } else {
          matches = txDate.getFullYear().toString() === selectedYear;
        }
        
        if (matches) {
          const record = {
            ...tx,
            clientName: client.name,
            clientPhone: client.phone,
          };
          if (tx.type === 'bill') {
            bills.push(record);
          } else {
            deposits.push(record);
          }
        }
      });
    });
    
    const totalBills = bills.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
    const totalDeposits = deposits.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0);
    
    return { bills, deposits, totalBills, totalDeposits };
  };

  const dailyData = useMemo(() => filterTransactions('daily'), [allTransactions, allClients, selectedDate]);
  const monthlyData = useMemo(() => filterTransactions('monthly'), [allTransactions, allClients, selectedMonth]);
  const yearlyData = useMemo(() => filterTransactions('yearly'), [allTransactions, allClients, selectedYear]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AE', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-AE', { year: 'numeric', month: 'long' });
  };

  const renderSummaryCards = (data: { totalBills: number; totalDeposits: number; bills: any[]; deposits: any[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bills</p>
              <p className="text-2xl font-bold text-blue-600">{data.totalBills.toFixed(2)} AED</p>
              <p className="text-xs text-muted-foreground">{data.bills.length} transactions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Deposits</p>
              <p className="text-2xl font-bold text-green-600">{data.totalDeposits.toFixed(2)} AED</p>
              <p className="text-xs text-muted-foreground">{data.deposits.length} transactions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Collection</p>
              <p className="text-2xl font-bold text-purple-600">{data.totalDeposits.toFixed(2)} AED</p>
              <p className="text-xs text-muted-foreground">Cash received</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTransactionTables = (data: { bills: any[]; deposits: any[] }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <FileText className="w-5 h-5" />
            Bills ({data.bills.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.bills.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No bills for this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bills.map((bill, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{bill.clientName}</p>
                        <p className="text-xs text-muted-foreground">{bill.clientPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{bill.description}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-600">
                      {parseFloat(bill.amount).toFixed(2)} AED
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Wallet className="w-5 h-5" />
            Deposits ({data.deposits.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.deposits.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No deposits for this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.deposits.map((deposit, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{deposit.clientName}</p>
                        <p className="text-xs text-muted-foreground">{deposit.clientPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{deposit.description}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {parseFloat(deposit.amount).toFixed(2)} AED
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Sales Reports
          </h1>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="daily" className="gap-2">
              <Calendar className="w-4 h-4" />
              Daily
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <CalendarDays className="w-4 h-4" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="yearly" className="gap-2">
              <CalendarRange className="w-4 h-4" />
              Yearly
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <div className="mb-4 p-4 bg-primary/5 rounded-lg border flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="date" className="text-sm font-medium">Select Date:</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-44"
                  data-testid="input-daily-date"
                />
              </div>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {renderSummaryCards(dailyData)}
                {renderTransactionTables(dailyData)}
              </>
            )}
          </TabsContent>

          <TabsContent value="monthly">
            <div className="mb-4 p-4 bg-primary/5 rounded-lg border flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">{formatMonth(selectedMonth)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="month" className="text-sm font-medium">Select Month:</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-44"
                  data-testid="input-monthly-date"
                />
              </div>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {renderSummaryCards(monthlyData)}
                {renderTransactionTables(monthlyData)}
              </>
            )}
          </TabsContent>

          <TabsContent value="yearly">
            <div className="mb-4 p-4 bg-primary/5 rounded-lg border flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">Year {selectedYear}</span>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="year" className="text-sm font-medium">Select Year:</Label>
                <Input
                  id="year"
                  type="number"
                  min="2020"
                  max="2030"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-32"
                  data-testid="input-yearly-date"
                />
              </div>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {renderSummaryCards(yearlyData)}
                {renderTransactionTables(yearlyData)}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
