import { storage } from "./storage";

export async function seedDatabase() {
  const existingProducts = await storage.getProducts();
  if (existingProducts.length === 0) {
    console.log("Seeding database...");
    
    // Sample data based on likely contents of a Laundry Wash file
    const products = [
      {
        name: "Ocean Breeze Liquid Detergent",
        description: "Fresh scent liquid detergent, effective on tough stains. 2L bottle.",
        price: "12.99",
        category: "Detergent",
        stockQuantity: 50,
        sku: "DET-OCEAN-2L",
        imageUrl: "https://images.unsplash.com/photo-1595180630489-35c917242d2a?q=80&w=2970&auto=format&fit=crop"
      },
      {
        name: "Lavender Softener",
        description: "Concentrated fabric softener with calming lavender scent. 1.5L.",
        price: "8.50",
        category: "Softener",
        stockQuantity: 30,
        sku: "SOFT-LAV-1.5L",
        imageUrl: "https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?q=80&w=2970&auto=format&fit=crop"
      },
      {
        name: "Sensitive Skin Wash",
        description: "Hypoallergenic liquid wash, fragrance-free. Suitable for baby clothes. 3L.",
        price: "18.00",
        category: "Sensitive",
        stockQuantity: 20,
        sku: "SENS-FREE-3L",
        imageUrl: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?q=80&w=2939&auto=format&fit=crop"
      },
      {
        name: "Stain Remover Gel",
        description: "Pre-wash gel for targeting specific stains. 500ml.",
        price: "5.99",
        category: "Stain Remover",
        stockQuantity: 100,
        sku: "STAIN-GEL-500ML",
        imageUrl: "https://images.unsplash.com/photo-1626806775351-53806825943a?q=80&w=2970&auto=format&fit=crop"
      },
       {
        name: "Eco-Friendly Pods",
        description: "Biodegradable laundry pods. Pack of 40.",
        price: "15.00",
        category: "Pods",
        stockQuantity: 75,
        sku: "PODS-ECO-40",
         imageUrl: "https://images.unsplash.com/photo-1604187351544-98e25e120da6?q=80&w=2970&auto=format&fit=crop"
      }
    ];

    for (const product of products) {
      await storage.createProduct(product);
    }
    console.log("Seeding complete.");
  }
}
