import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, UserCheck, CreditCard, Banknote, Building } from "lucide-react";
import { insertClientSchema } from "@shared/schema";
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

interface ClientFormProps {
  mode: "create" | "edit";
  client?: Client;
  onSuccess?: () => void;
}

export function ClientForm({ mode, client, onSuccess }: ClientFormProps) {
  const { toast } = useToast();
  const { mutate: createClient, isPending: isCreating } = useCreateClient();
  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient();
  const [existingClient, setExistingClient] = useState<Client | null>(null);
  const [showAddBillMode, setShowAddBillMode] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: client?.name || "",
      address: client?.address || "",
      phone: client?.phone || "+971",
      amount: client?.amount || "0",
      deposit: client?.deposit || "0",
      balance: client?.balance || "0",
      notes: client?.notes || "",
      billNumber: client?.billNumber || "",
      preferredPaymentMethod: client?.preferredPaymentMethod || "cash",
      discountPercent: client?.discountPercent || "0",
    },
  });

  const watchName = form.watch("name");
  const watchPhone = form.watch("phone");
  const watchAmount = form.watch("amount");
  const watchDeposit = form.watch("deposit");

  const checkDuplicate = useCallback(async (name: string, phone: string) => {
    if (!name || !phone || mode === "edit") return;
    try {
      const response = await fetch("/api/clients/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await response.json();
      if (data.exists && data.client) {
        setExistingClient(data.client);
      } else {
        setExistingClient(null);
        setShowAddBillMode(false);
      }
    } catch (err) {
      setExistingClient(null);
    }
  }, [mode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchName && watchPhone) {
        checkDuplicate(watchName.trim(), watchPhone.trim());
      } else {
        setExistingClient(null);
        setShowAddBillMode(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [watchName, watchPhone, checkDuplicate]);

  useEffect(() => {
    const amt = parseFloat(watchAmount || "0");
    const dep = parseFloat(watchDeposit || "0");
    const bal = (amt - dep).toFixed(2);
    form.setValue("balance", bal);
  }, [watchAmount, watchDeposit, form]);

  const addBillMutation = useMutation({
    mutationFn: async ({ clientId, amount, description }: { clientId: number; amount: string; description: string }) => {
      return await apiRequest("POST", `/api/clients/${clientId}/bill`, { amount, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Bill Added",
        description: `New bill added to ${existingClient?.name}`,
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add bill",
        variant: "destructive",
      });
    },
  });

  const handleAddBillToExisting = () => {
    if (!existingClient) return;
    const amount = form.getValues("amount");
    const billNumber = form.getValues("billNumber");
    addBillMutation.mutate({
      clientId: existingClient.id,
      amount: amount || "0",
      description: billNumber ? `Bill #${billNumber}` : "New bill",
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    if (existingClient && !showAddBillMode) {
      return;
    }

    // Validate required fields
    if (!data.name || data.name.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please enter the client's name.",
        variant: "destructive",
      });
      return;
    }

    if (!data.phone || data.phone.trim() === "" || data.phone.trim() === "+971") {
      toast({
        title: "Missing Information",
        description: "Please enter the client's phone number.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(data.amount || "0");
    const deposit = parseFloat(data.deposit || "0");
    const balance = (amount - deposit).toFixed(2);
    
    const payload = {
      ...data,
      amount: amount.toFixed(2),
      deposit: deposit.toFixed(2),
      balance: balance,
    };
    
    if (mode === "create") {
      createClient(payload, {
        onSuccess: () => {
          toast({
            title: "Client added",
            description: `${data.name} has been added successfully.`,
          });
          onSuccess?.();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to add client",
            variant: "destructive",
          });
        },
      });
    } else if (client) {
      updateClient(
        { id: client.id, data: payload },
        {
          onSuccess: () => {
            toast({
              title: "Client updated",
              description: `${data.name} has been updated successfully.`,
            });
            onSuccess?.();
          },
          onError: (error) => {
            toast({
              title: "Error",
              description: error.message || "Failed to update client",
              variant: "destructive",
            });
          },
        }
      );
    }
  });

  const isPending = isCreating || isUpdating || addBillMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter client name" {...field} data-testid="input-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address *</FormLabel>
              <FormControl>
                <Input placeholder="Enter address" {...field} data-testid="input-address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number *</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-1">
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                      +971
                    </span>
                    <Input 
                      className={`rounded-l-none ${field.value.replace(/^\+971/, "").replace(/\D/g, "").length >= 9 ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                      placeholder="XXXXXXXXX" 
                      value={field.value.replace(/^\+971/, "").replace(/\D/g, "").slice(0, 9)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                        field.onChange("+971" + digits);
                      }}
                      inputMode="numeric"
                      maxLength={9}
                      data-testid="input-phone" 
                    />
                  </div>
                  {field.value.replace(/^\+971/, "").replace(/\D/g, "").length >= 9 && (
                    <p className="text-xs text-green-600 font-medium">9 digits - limit reached</p>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "edit" && client?.billNumber && (
          <div className="space-y-2">
            <FormLabel>Account Number</FormLabel>
            <Input 
              value={client.billNumber} 
              disabled 
              className="bg-muted cursor-not-allowed"
              data-testid="input-account-number-readonly" 
            />
          </div>
        )}

        {existingClient && mode === "create" && (
          <div className="p-4 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 space-y-3" data-testid="existing-client-warning">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-800 dark:text-amber-400">Client Already Exists</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  A client with this name and phone number already exists in the system.
                </p>
              </div>
            </div>
            <div className="bg-card rounded-md p-3 space-y-1 border">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span className="font-medium">{existingClient.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">Phone: {existingClient.phone}</p>
              <p className="text-sm text-muted-foreground">Address: {existingClient.address || "N/A"}</p>
              <div className="flex gap-4 text-sm mt-2 pt-2 border-t">
                <span>Total Bill: <strong className="text-primary">{existingClient.amount} AED</strong></span>
                <span>Deposit: <strong className="text-green-600">{existingClient.deposit} AED</strong></span>
                <span>Due: <strong className="text-destructive">{existingClient.balance} AED</strong></span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleAddBillToExisting}
                disabled={isPending}
                className="flex-1"
                data-testid="button-add-bill-existing"
              >
                {addBillMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add New Bill ({watchAmount || "0"} AED) to This Client
              </Button>
            </div>
          </div>
        )}

        
        <Button
          type="submit"
          className="w-full rounded-full bg-primary hover:bg-primary/90 font-semibold"
          disabled={isPending || (existingClient !== null && mode === "create")}
          data-testid="button-submit"
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {existingClient && mode === "create" 
            ? "Client Already Exists - Use Add Bill Button Above" 
            : mode === "create" 
              ? "Add New Client" 
              : "Update Client"}
        </Button>
      </form>
    </Form>
  );
}
