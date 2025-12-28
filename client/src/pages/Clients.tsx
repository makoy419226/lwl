import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ClientCard } from "@/components/ClientCard";
import { useClients } from "@/hooks/use-clients";
import { Loader2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/ClientForm";

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: clients, isLoading, isError } = useClients(searchTerm);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
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

      <main className="flex-1 container mx-auto px-4 py-8 overflow-auto">
        <div className="mb-8">
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
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
            <Users className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No clients found</h3>
            <p className="max-w-md text-center">
              {searchTerm 
                ? `No clients match "${searchTerm}". Try a different search term.` 
                : "Your client list is empty. Click the 'Add Client' button to get started."}
            </p>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {clients?.map((client) => (
              <motion.div key={client.id} variants={item}>
                <ClientCard client={client} />
              </motion.div>
            ))}
          </motion.div>
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

    </div>
  );
}
