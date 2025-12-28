import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product } from "@shared/schema";
import { z } from "zod";
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Extend schema to coerce numbers from string inputs
const formSchema = insertProductSchema.extend({
  stockQuantity: z.coerce.number().min(0),
  price: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  defaultValues?: Product;
  onSuccess?: () => void;
  mode: "create" | "edit";
}

export function ProductForm({ defaultValues, onSuccess, mode }: ProductFormProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ? {
      ...defaultValues,
      stockQuantity: defaultValues.stockQuantity || 0,
      price: defaultValues.price || "",
      description: defaultValues.description || "",
      sku: defaultValues.sku || "",
      imageUrl: defaultValues.imageUrl || "",
      category: defaultValues.category || "Laundry",
    } : {
      name: "",
      description: "",
      category: "Laundry",
      stockQuantity: 0,
      price: "",
      sku: "",
      imageUrl: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    if (mode === "create") {
      createProduct.mutate(values, {
        onSuccess: () => {
          form.reset();
          onSuccess?.();
        }
      });
    } else if (mode === "edit" && defaultValues) {
      updateProduct.mutate({ id: defaultValues.id, ...values }, {
        onSuccess: () => onSuccess?.()
      });
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Lavender Softener" {...field} className="rounded-lg" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "Laundry"}>
                  <FormControl>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Laundry">Laundry</SelectItem>
                    <SelectItem value="Detergent">Detergent</SelectItem>
                    <SelectItem value="Softener">Softener</SelectItem>
                    <SelectItem value="Stain Remover">Stain Remover</SelectItem>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="L-101" {...field} value={field.value || ""} className="rounded-lg" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stockQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock</FormLabel>
                <FormControl>
                  <Input type="number" {...field} className="rounded-lg" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe the product..." 
                  className="resize-none rounded-lg" 
                  {...field} 
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} value={field.value || ""} className="rounded-lg" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-2">
          <Button 
            type="submit" 
            className="w-full rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            disabled={isPending}
          >
            {isPending ? "Saving..." : (mode === "create" ? "Add Product" : "Save Changes")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
