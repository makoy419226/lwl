import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product } from "@shared/schema";
import { z } from "zod";
import { useCreateProduct, useUpdateProduct, useProducts } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, X, Image, Sparkles } from "lucide-react";
import { getProductImage } from "@/lib/productImages";

const CATEGORIES = [
  "Arabic Clothes",
  "Men's Clothes",
  "Ladies' Clothes",
  "Baby Clothes",
  "Linens",
  "Shop Items",
  "General Items",
  "Shoes, Carpets & More",
];

const CARPET_CATEGORY = "Shoes, Carpets & More";

// Extend schema to coerce numbers from string inputs
const formSchema = insertProductSchema.extend({
  stockQuantity: z.coerce.number().min(0).optional(),
  price: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  dryCleanPrice: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  ironOnlyPrice: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  smallPrice: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  mediumPrice: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  largePrice: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  sqmPrice: z.string().optional().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  isSqmPriced: z.boolean().optional(),
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
  const { data: products } = useProducts();
  const [imagePreview, setImagePreview] = useState<string>(defaultValues?.imageUrl || "");
  const [isCustomImage, setIsCustomImage] = useState<boolean>(!!defaultValues?.imageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          
          const targetSize = 400;
          canvas.width = targetSize;
          canvas.height = targetSize;
          
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, 0, targetSize, targetSize);
          
          const scale = Math.min(targetSize / img.width, targetSize / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = (targetSize - scaledWidth) / 2;
          const y = (targetSize - scaledHeight) / 2;
          
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
          
          const processedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve(processedBase64);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const processedBase64 = await processImage(file);
        setImagePreview(processedBase64);
        setIsCustomImage(true);
        form.setValue("imageUrl", processedBase64);
      } catch (error) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setImagePreview(base64);
          setIsCustomImage(true);
          form.setValue("imageUrl", base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const clearImage = () => {
    setImagePreview("");
    setIsCustomImage(false);
    form.setValue("imageUrl", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ? {
      name: defaultValues.name,
      price: defaultValues.price || "",
      dryCleanPrice: defaultValues.dryCleanPrice || "",
      ironOnlyPrice: defaultValues.ironOnlyPrice || "",
      smallPrice: defaultValues.smallPrice || "",
      mediumPrice: defaultValues.mediumPrice || "",
      largePrice: defaultValues.largePrice || "",
      sqmPrice: defaultValues.sqmPrice || "",
      isSqmPriced: defaultValues.isSqmPriced || false,
      description: defaultValues.description || "",
      sku: defaultValues.sku || "",
      imageUrl: defaultValues.imageUrl || "",
      category: defaultValues.category || "Arabic Clothes",
      stockQuantity: defaultValues.stockQuantity ?? undefined,
    } : {
      name: "",
      description: "",
      category: "Arabic Clothes",
      price: "",
      dryCleanPrice: "",
      ironOnlyPrice: "",
      smallPrice: "",
      mediumPrice: "",
      largePrice: "",
      sqmPrice: "",
      isSqmPriced: false,
      sku: "",
      imageUrl: "",
    },
  });

  const watchedName = form.watch("name");
  const watchedCategory = form.watch("category");

  const autoMatchedImage = useMemo(() => {
    if (watchedName && watchedName.length >= 2) {
      return getProductImage(watchedName);
    }
    return null;
  }, [watchedName]);

  const displayImage = isCustomImage ? imagePreview : (autoMatchedImage || imagePreview);

  useEffect(() => {
    if (mode === "create" && watchedName && watchedName.length >= 3 && watchedCategory) {
      const prefix = watchedName.substring(0, 3).toUpperCase();
      const categoryProducts = products?.filter(p => p.category === watchedCategory) || [];
      const nextNumber = categoryProducts.length + 1;
      const newSKU = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
      form.setValue("sku", newSKU);
    }
  }, [watchedName, watchedCategory, mode, products, form]);

  const watchedIsSqmPriced = form.watch("isSqmPriced");
  const isCarpetCategory = watchedCategory === CARPET_CATEGORY || !!watchedIsSqmPriced;

  useEffect(() => {
    if (watchedCategory === CARPET_CATEGORY) {
      form.setValue("isSqmPriced", true);
      form.setValue("price", "");
      form.setValue("dryCleanPrice", "");
      form.setValue("ironOnlyPrice", "");
      form.setValue("smallPrice", "");
      form.setValue("mediumPrice", "");
      form.setValue("largePrice", "");
    }
  }, [watchedCategory, form]);

  const onSubmit = (values: FormValues) => {
    const submitValues = {
      ...values,
      isSqmPriced: values.category === CARPET_CATEGORY || !!values.isSqmPriced,
    };
    if (mode === "create") {
      createProduct.mutate(submitValues, {
        onSuccess: () => {
          form.reset();
          onSuccess?.();
        }
      });
    } else if (mode === "edit" && defaultValues) {
      updateProduct.mutate({ id: defaultValues.id, ...submitValues }, {
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

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || "Arabic Clothes"}>
                <FormControl>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isCarpetCategory ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Per Square Meter Pricing (carpet items)</p>
            <p className="text-xs text-muted-foreground">DC = 2x rate, Iron = 0.5x rate. Price is calculated by multiplying the rate by the area in sqm.</p>
            <FormField
              control={form.control}
              name="sqmPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per SQM (AED)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-sqm-price" type="number" step="0.01" placeholder="12.00" {...field} value={field.value || ""} className="rounded-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Normal Price (AED)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dryCleanPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dry Clean Price (AED)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ironOnlyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Iron Only Price (AED)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Size Pricing (for blankets, towels, etc.)</p>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="smallPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Small (AED)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mediumPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medium (AED)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="largePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Large (AED)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </>
        )}

        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU (Auto-generated)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Auto-generated" 
                  {...field} 
                  value={field.value || ""} 
                  className="rounded-lg bg-muted"
                  readOnly
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <FormLabel>Product Image</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  {displayImage ? (
                    <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                      <img 
                        src={displayImage} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                      {!isCustomImage && autoMatchedImage && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Auto-matched
                        </div>
                      )}
                      {isCustomImage && (
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={clearImage}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div 
                      className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Image className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload image</span>
                      <span className="text-xs text-muted-foreground">(JPG, PNG, WebP)</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {displayImage ? "Upload Custom Image" : "Upload Image"}
                  </Button>
                </div>
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
