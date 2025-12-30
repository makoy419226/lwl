import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import { Loader2, Users, Trash2, Edit, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/ClientForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Client } from "@shared/schema";

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { data: clients, isLoading, isError } = useClients(searchTerm);
  const { mutate: deleteClient } = useDeleteClient();
  const { toast } = useToast();

  const handleDelete = (client: Client) => {
    if (confirm(`Are you sure you want to delete ${client.name}?`)) {
      deleteClient(client.id, {
        onSuccess: () => {
          toast({
            title: "Client deleted",
            description: `${client.name} has been removed.`,
          });
        },
      });
    }
  };

  const openWhatsApp = (contact: string | null) => {
    if (contact) {
      window.open(contact, "_blank");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar 
        onSearch={setSearchTerm} 
        searchValue={searchTerm}
        onAddClick={() => setIsCreateOpen(true)}
        addButtonLabel="Add Client"
        pageTitle="Clients"
      />

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        <div className="mb-6">
          <p className="text-muted-foreground">Manage your customer accounts and balances.</p>
          <div className="mt-4 text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full inline-block">
            Total Clients: <span className="text-primary">{clients?.length || 0}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>Loading clients...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <p className="font-semibold text-lg">Failed to load clients</p>
            <p className="text-sm opacity-80">Please try refreshing the page.</p>
          </div>
        ) : clients?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-card/50">
            <Users className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No clients found</h3>
            <p className="max-w-md text-center">
              {searchTerm 
                ? `No clients match "${searchTerm}". Try a different search term.` 
                : "Your client list is empty. Click the 'Add Client' button to get started."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="font-bold text-foreground w-16">No.</TableHead>
                  <TableHead className="font-bold text-foreground">Client Name</TableHead>
                  <TableHead className="font-bold text-foreground">Contact / Address</TableHead>
                  <TableHead className="font-bold text-foreground text-right">Due Bill (AED)</TableHead>
                  <TableHead className="font-bold text-foreground text-center w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map((client, index) => (
                  <TableRow 
                    key={client.id}
                    className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell className="font-medium text-muted-foreground" data-testid={`text-serial-${client.id}`}>
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-semibold" data-testid={`text-client-name-${client.id}`}>
                      {client.name}
                      {client.billNumber && (
                        <span className="ml-2 text-xs text-muted-foreground">({client.billNumber})</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-client-contact-${client.id}`}>
                      <div className="space-y-1">
                        {client.phone && (
                          <p className="text-sm">{client.phone}</p>
                        )}
                        {client.address && (
                          <p className="text-sm text-muted-foreground">{client.address}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell 
                      className={`text-right font-bold ${parseFloat(client.balance || "0") > 0 ? "text-destructive" : "text-primary"}`}
                      data-testid={`text-client-balance-${client.id}`}
                    >
                      {parseFloat(client.balance || "0").toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {client.contact && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            onClick={() => openWhatsApp(client.contact)}
                            data-testid={`button-whatsapp-${client.id}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingClient(client)}
                          data-testid={`button-edit-${client.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(client)}
                          data-testid={`button-delete-${client.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm 
            mode="create" 
            onSuccess={() => setIsCreateOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Edit Client</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm 
              mode="edit"
              client={editingClient}
              onSuccess={() => setEditingClient(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
