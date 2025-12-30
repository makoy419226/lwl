import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useBills, useDeleteBill } from "@/hooks/use-bills";
import { useClients } from "@/hooks/use-clients";
import { Loader2, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BillForm } from "@/components/BillForm";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Bills() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: bills, isLoading, isError } = useBills();
  const { data: clients = [] } = useClients();
  const { mutate: deleteBill } = useDeleteBill();
  const { toast } = useToast();

  const getClientName = (clientId: number) => {
    return clients.find(c => c.id === clientId)?.name || "Unknown Client";
  };

  const handleDelete = (billId: number) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      deleteBill(billId, {
        onSuccess: () => {
          toast({
            title: "Bill deleted",
            description: "The bill has been removed.",
          });
        },
      });
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar 
        onSearch={() => {}}
        searchValue=""
        onAddClick={() => setIsCreateOpen(true)}
        addButtonLabel="Add Bill"
        pageTitle="Bills"
      />

      <main className="flex-1 container mx-auto px-4 py-8 overflow-auto">
        <div className="mb-8">
          <p className="text-muted-foreground">Track bill entries for customers.</p>
          <div className="mt-4 text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full inline-block">
            Total Bills: <span className="text-primary">{bills?.length || 0}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>Loading bills...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <p className="font-semibold text-lg">Failed to load bills</p>
            <p className="text-sm opacity-80">Please try refreshing the page.</p>
          </div>
        ) : bills?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No bills found</h3>
            <p className="max-w-md text-center">Your bills list is empty. Click the 'Add Bill' button to create your first bill entry.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bills?.map((bill) => (
              <Card key={bill.id} className="border-border/50 hover:shadow-md transition-shadow" data-testid={`card-bill-${bill.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{getClientName(bill.clientId)}</CardTitle>
                      {bill.referenceNumber && (
                        <p className="text-xs text-muted-foreground mt-1">{bill.referenceNumber}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(bill.id)}
                      data-testid="button-delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Amount</p>
                      <p className="text-lg font-bold text-primary">AED {parseFloat(bill.amount || "0").toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Date</p>
                      <p className="text-sm font-semibold text-foreground">{format(new Date(bill.billDate), "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                  {bill.description && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Description</p>
                      <p className="text-sm text-foreground">{bill.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Add New Bill</DialogTitle>
          </DialogHeader>
          <BillForm onSuccess={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
