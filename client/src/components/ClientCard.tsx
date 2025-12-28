import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClientForm } from "./ClientForm";
import { useState } from "react";
import { useDeleteClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

interface ClientCardProps {
  client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { mutate: deleteClient } = useDeleteClient();
  const { toast } = useToast();

  const handleDelete = () => {
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

  const balanceColor = 
    parseFloat(client.balance || "0") > 0 ? "text-destructive" : "text-primary";

  return (
    <>
      <Card 
        className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 overflow-hidden"
        data-testid={`card-client-${client.id}`}
      >
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground truncate">{client.name}</h3>
                {client.billNumber && (
                  <p className="text-xs text-muted-foreground">{client.billNumber}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      data-testid="button-edit"
                    >
                      ✎
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-display text-primary">Edit Client</DialogTitle>
                    </DialogHeader>
                    <ClientForm 
                      mode="edit"
                      client={client}
                      onSuccess={() => setIsEditOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 rounded-md text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                  data-testid="button-delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Amount</p>
                <p className="text-sm font-semibold text-foreground">AED {parseFloat(client.amount || "0").toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Deposit</p>
                <p className="text-sm font-semibold text-foreground">AED {parseFloat(client.deposit || "0").toFixed(2)}</p>
              </div>
            </div>

            {/* Balance */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium mb-1">Balance</p>
              <p className={`text-lg font-bold ${balanceColor}`}>
                AED {parseFloat(client.balance || "0").toFixed(2)}
              </p>
            </div>

            {/* Contact */}
            {client.contact && (
              <a 
                href={client.contact}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                data-testid={`link-contact-${client.id}`}
              >
                Contact via WhatsApp
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* Address */}
            {client.address && (
              <p className="text-xs text-muted-foreground">{client.address}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
