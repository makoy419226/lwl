import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { insertClientSchema } from "@shared/schema";
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
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

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: client?.name || "",
      address: client?.address || "",
      phone: client?.phone || "",
      amount: client?.amount || "0",
      deposit: client?.deposit || "0",
      balance: client?.balance || "0",
      contact: client?.contact || "",
      billNumber: client?.billNumber || "",
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    if (mode === "create") {
      createClient(data, {
        onSuccess: () => {
          toast({
            title: "Client added",
            description: `${data.name} has been added successfully.`,
          });
          onSuccess?.();
        },
      });
    } else if (client) {
      updateClient(
        { id: client.id, data },
        {
          onSuccess: () => {
            toast({
              title: "Client updated",
              description: `${data.name} has been updated successfully.`,
            });
            onSuccess?.();
          },
        }
      );
    }
  });

  const isPending = isCreating || isUpdating;

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
              <FormLabel>Address</FormLabel>
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
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter phone number" {...field} data-testid="input-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (AED)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-amount" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deposit (AED)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-deposit" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Balance (AED)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-balance" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp Contact</FormLabel>
              <FormControl>
                <Input placeholder="https://wa.me/1234567890" {...field} data-testid="input-contact" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bill Number</FormLabel>
              <FormControl>
                <Input placeholder="BL-2024-001" {...field} data-testid="input-billNumber" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full rounded-full bg-primary hover:bg-primary/90 font-semibold"
          disabled={isPending}
          data-testid="button-submit"
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Add Client" : "Update Client"}
        </Button>
      </form>
    </Form>
  );
}
