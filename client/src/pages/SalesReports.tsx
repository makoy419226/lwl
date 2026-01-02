import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, TrendingUp, Wallet, Receipt, FileText, CalendarDays, CalendarRange, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
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

  const getCurrentData = () => {
    if (activeTab === 'daily') return { data: dailyData, label: formatDate(selectedDate), filename: `sales-${selectedDate}` };
    if (activeTab === 'monthly') return { data: monthlyData, label: formatMonth(selectedMonth), filename: `sales-${selectedMonth}` };
    return { data: yearlyData, label: `Year ${selectedYear}`, filename: `sales-${selectedYear}` };
  };

  const exportToExcel = () => {
    const { data, label, filename } = getCurrentData();
    
    const summaryData = [
      ['Liquid Washes Laundry - Sales Report'],
      [`Period: ${label}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Summary'],
      ['Total Bills', `${data.totalBills.toFixed(2)} AED`],
      ['Total Deposits', `${data.totalDeposits.toFixed(2)} AED`],
      ['Net Collection', `${data.totalDeposits.toFixed(2)} AED`],
      ['Total Transactions', data.bills.length + data.deposits.length],
    ];

    const transactionsData = [
      [],
      ['All Transactions'],
      ['Type', 'Client', 'Phone', 'Description', 'Amount (AED)', 'Date'],
      ...data.bills.map(b => ['Bill', b.clientName, b.clientPhone || '', b.description || '', parseFloat(b.amount).toFixed(2), new Date(b.date).toLocaleDateString()]),
      ...data.deposits.map(d => ['Deposit', d.clientName, d.clientPhone || '', d.description || '', parseFloat(d.amount).toFixed(2), new Date(d.date).toLocaleDateString()]),
    ];

    const wsData = [...summaryData, ...transactionsData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 12 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportToPDF = async () => {
    const { data, label, filename } = getCurrentData();
    
    const html2pdf = (await import('html2pdf.js')).default;
    
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #1e40af; margin: 0;">Liquid Washes Laundry</h1>
          <p style="color: #666; margin: 5px 0;">Centra Market D/109, Al Dhanna City, Al Ruwais, Abu Dhabi-UAE</p>
          <h2 style="margin: 15px 0 5px;">Sales Report</h2>
          <p style="color: #666;">${label}</p>
        </div>
        
        <div style="display: flex; justify-content: space-around; margin-bottom: 30px; text-align: center;">
          <div style="padding: 15px; background: #eff6ff; border-radius: 8px; flex: 1; margin: 0 10px;">
            <p style="color: #666; margin: 0; font-size: 12px;">Total Bills</p>
            <p style="color: #2563eb; font-size: 24px; font-weight: bold; margin: 5px 0;">${data.totalBills.toFixed(2)} AED</p>
            <p style="color: #666; font-size: 11px; margin: 0;">${data.bills.length} transactions</p>
          </div>
          <div style="padding: 15px; background: #f0fdf4; border-radius: 8px; flex: 1; margin: 0 10px;">
            <p style="color: #666; margin: 0; font-size: 12px;">Total Deposits</p>
            <p style="color: #16a34a; font-size: 24px; font-weight: bold; margin: 5px 0;">${data.totalDeposits.toFixed(2)} AED</p>
            <p style="color: #666; font-size: 11px; margin: 0;">${data.deposits.length} transactions</p>
          </div>
          <div style="padding: 15px; background: #faf5ff; border-radius: 8px; flex: 1; margin: 0 10px;">
            <p style="color: #666; margin: 0; font-size: 12px;">Net Collection</p>
            <p style="color: #9333ea; font-size: 24px; font-weight: bold; margin: 5px 0;">${data.totalDeposits.toFixed(2)} AED</p>
            <p style="color: #666; font-size: 11px; margin: 0;">Cash received</p>
          </div>
        </div>

        ${data.bills.length > 0 ? `
        <h3 style="color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Bills (${data.bills.length})</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Client</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.bills.map(b => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${b.clientName}<br><small style="color: #666;">${b.clientPhone || ''}</small></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${b.description || '-'}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; color: #2563eb; font-weight: bold;">${parseFloat(b.amount).toFixed(2)} AED</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        ${data.deposits.length > 0 ? `
        <h3 style="color: #16a34a; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Deposits (${data.deposits.length})</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Client</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.deposits.map(d => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.clientName}<br><small style="color: #666;">${d.clientPhone || ''}</small></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.description || '-'}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; color: #16a34a; font-weight: bold;">${parseFloat(d.amount).toFixed(2)} AED</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
          Generated on ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = content;
    document.body.appendChild(container);

    html2pdf()
      .set({
        margin: 10,
        filename: `${filename}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(container)
      .save()
      .then(() => {
        document.body.removeChild(container);
      });
  };

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Sales Reports
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              {activeTab === "daily" && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-primary" />
                  <Label htmlFor="header-date" className="text-sm font-medium">Date:</Label>
                  <Input
                    id="header-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-40 h-8"
                    data-testid="input-header-daily-date"
                  />
                </div>
              )}
              {activeTab === "monthly" && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <Label htmlFor="header-month" className="text-sm font-medium">Month:</Label>
                  <Input
                    id="header-month"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-40 h-8"
                    data-testid="input-header-monthly-date"
                  />
                </div>
              )}
              {activeTab === "yearly" && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
                  <CalendarRange className="w-4 h-4 text-primary" />
                  <Label htmlFor="header-year" className="text-sm font-medium">Year:</Label>
                  <Input
                    id="header-year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-24 h-8"
                    data-testid="input-header-yearly-date"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={isLoading}
                  data-testid="button-export-excel"
                  className="gap-1"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportToPDF}
                  disabled={isLoading}
                  data-testid="button-export-pdf"
                  className="gap-1"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </Button>
              </div>
            </div>
          </div>
          <TabsList>
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
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
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
      </main>
    </Tabs>
  );
}
