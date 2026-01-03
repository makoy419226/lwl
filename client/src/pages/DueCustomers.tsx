import { useState } from "react";
import { useClients } from "@/hooks/use-clients";
import { Link } from "wouter";
import { Loader2, Users, Phone, AlertCircle, Search, ArrowUpDown, CircleDollarSign } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@shared/schema";

export default function DueCustomers() {
  const { data: clients, isLoading } = useClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const dueCustomers = (clients || [])
    .filter(client => parseFloat(client.balance || "0") > 0)
    .filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const balanceA = parseFloat(a.balance || "0");
      const balanceB = parseFloat(b.balance || "0");
      return sortOrder === "desc" ? balanceB - balanceA : balanceA - balanceB;
    });

  const totalDue = dueCustomers.reduce((sum, client) => sum + parseFloat(client.balance || "0"), 0);

  const sendWhatsAppReminder = (client: Client) => {
    const message = `Dear ${client.name},%0A%0AThis is a friendly reminder that you have an outstanding balance of AED ${parseFloat(client.balance || "0").toFixed(2)} at Liquid Washes Laundry.%0A%0APlease visit us at your earliest convenience to settle your account.%0A%0AThank you!%0A%0ALiquid Washes Laundry%0ACentra Market D/109, Al Dhanna City%0AAl Ruwais, Abu Dhabi-UAE`;
    window.open(`https://wa.me/${client.phone?.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center gap-4">
          <CircleDollarSign className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Due Customers</h1>
            <p className="text-sm text-muted-foreground">Customers with outstanding balance</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Due Amount</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-total-due">
                AED {totalDue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers with Due</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-due-count">
                {dueCustomers.length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Due</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-due">
                AED {dueCustomers.length > 0 ? (totalDue / dueCustomers.length).toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-destructive" />
                Due Customer List
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-due"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                  data-testid="button-sort"
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  {sortOrder === "desc" ? "Highest First" : "Lowest First"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dueCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No customers with outstanding balance</p>
                <p className="text-sm">All customers have cleared their dues</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total Bills</TableHead>
                    <TableHead className="text-right">Total Deposits</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dueCustomers.map((client) => (
                    <TableRow key={client.id} data-testid={`row-due-customer-${client.id}`}>
                      <TableCell>
                        <Link href={`/clients/${client.id}`}>
                          <span className="font-medium text-primary hover:underline cursor-pointer">
                            {client.name}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {client.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {client.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        AED {parseFloat(client.amount || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        AED {parseFloat(client.deposit || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="font-bold">
                          AED {parseFloat(client.balance || "0").toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/clients/${client.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-${client.id}`}>
                              View
                            </Button>
                          </Link>
                          {client.phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600"
                              onClick={() => sendWhatsAppReminder(client)}
                              data-testid={`button-remind-${client.id}`}
                            >
                              <SiWhatsapp className="w-4 h-4 mr-1" />
                              Remind
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
