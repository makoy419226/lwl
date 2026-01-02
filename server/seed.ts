import { db } from "./db";
import { products, clients, users, packingWorkers } from "@shared/schema";
import { storage } from "./storage";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const laundryItems = [
  { name: "Kandoora/Thob", description: "Traditional men's robe", price: "5.00", category: "Traditional Wear", stockQuantity: 100, sku: "KAND-001" },
  { name: "Ghutra", description: "Traditional head covering", price: "5.00", category: "Traditional Wear", stockQuantity: 100, sku: "GHUT-001" },
  { name: "Wezar/Lungi", description: "Traditional wrap garment", price: "4.00", category: "Traditional Wear", stockQuantity: 100, sku: "WEZA-001" },
  { name: "Fanela/Vest", description: "Undershirt/vest", price: "2.00", category: "Undergarments", stockQuantity: 100, sku: "FANE-001" },
  { name: "Underwear", description: "Undergarment", price: "2.00", category: "Undergarments", stockQuantity: 100, sku: "UNDE-001" },
  { name: "Socks", description: "Pair of socks", price: "2.00", category: "Accessories", stockQuantity: 100, sku: "SOCK-001" },
  { name: "Cap", description: "Head cap", price: "2.00", category: "Accessories", stockQuantity: 100, sku: "CAP-001" },
  { name: "Shirt/Blouse", description: "Formal shirt or blouse", price: "3.00", category: "Tops", stockQuantity: 100, sku: "SHIR-001" },
  { name: "T-Shirt (Normal)", description: "Regular t-shirt wash", price: "3.00", category: "Tops", stockQuantity: 100, sku: "TSHI-001" },
  { name: "T-Shirt (Dry Clean)", description: "T-shirt dry cleaning", price: "5.00", category: "Tops", stockQuantity: 100, sku: "TSHI-002" },
  { name: "Jeans Pant/Trouser", description: "Jeans or trousers", price: "3.00", category: "Bottoms", stockQuantity: 100, sku: "JEAN-001" },
  { name: "Track Pant (Normal)", description: "Regular track pant wash", price: "4.00", category: "Bottoms", stockQuantity: 100, sku: "TRAC-001" },
  { name: "Track Pant (Dry Clean)", description: "Track pant dry cleaning", price: "6.00", category: "Bottoms", stockQuantity: 100, sku: "TRAC-002" },
  { name: "Coveral", description: "Full body coverall", price: "7.00", category: "Workwear", stockQuantity: 100, sku: "COVE-001" },
  { name: "Jacket", description: "Jacket", price: "5.00", category: "Outerwear", stockQuantity: 100, sku: "JACK-001" },
  { name: "Sweater", description: "Sweater/pullover", price: "5.00", category: "Outerwear", stockQuantity: 100, sku: "SWEA-001" },
  { name: "Short", description: "Shorts", price: "2.00", category: "Bottoms", stockQuantity: 100, sku: "SHOR-001" },
  { name: "Military Dress", description: "Military uniform", price: "10.00", category: "Specialty", stockQuantity: 100, sku: "MILI-001" },
  { name: "Suit/Coat (Normal)", description: "Regular suit/coat wash", price: "25.00", category: "Formal Wear", stockQuantity: 100, sku: "SUIT-001" },
  { name: "Suit/Coat (Dry Clean)", description: "Suit/coat dry cleaning", price: "35.00", category: "Formal Wear", stockQuantity: 100, sku: "SUIT-002" },
  { name: "Table Cloth (Small)", description: "Small table cloth", price: "5.00", category: "Home Linens", stockQuantity: 100, sku: "TABL-001" },
  { name: "Table Cloth (Large)", description: "Large table cloth", price: "8.00", category: "Home Linens", stockQuantity: 100, sku: "TABL-002" },
  { name: "Salawar Qamees", description: "Traditional outfit", price: "6.00", category: "Traditional Wear", stockQuantity: 100, sku: "SALA-001" },
  { name: "Ladies Bras", description: "Ladies undergarment", price: "3.00", category: "Undergarments", stockQuantity: 100, sku: "BRAS-001" },
  { name: "Ladies Suit", description: "Ladies formal suit", price: "10.00", category: "Formal Wear", stockQuantity: 100, sku: "LADY-001" },
  { name: "Saree", description: "Traditional Indian garment", price: "40.00", category: "Traditional Wear", stockQuantity: 100, sku: "SARE-001" },
  { name: "Abaya", description: "Traditional ladies robe", price: "10.00", category: "Traditional Wear", stockQuantity: 100, sku: "ABAY-001" },
  { name: "Shela", description: "Traditional scarf/shawl", price: "5.00", category: "Accessories", stockQuantity: 100, sku: "SHEL-001" },
  { name: "Ladies Pusthan", description: "Traditional ladies dress", price: "10.00", category: "Traditional Wear", stockQuantity: 100, sku: "PUST-001" },
  { name: "Party Dress (Male)", description: "Men's party dress", price: "25.00", category: "Formal Wear", stockQuantity: 100, sku: "PART-001" },
  { name: "Party Dress (Female)", description: "Ladies party dress", price: "25.00", category: "Formal Wear", stockQuantity: 100, sku: "PART-002" },
  { name: "Skirt", description: "Ladies skirt", price: "5.00", category: "Bottoms", stockQuantity: 100, sku: "SKIR-001" },
  { name: "Pillow Cover", description: "Pillow case cover", price: "2.00", category: "Bedding", stockQuantity: 100, sku: "PILL-001" },
  { name: "Pillow", description: "Full pillow cleaning", price: "2.00", category: "Bedding", stockQuantity: 100, sku: "PILL-002" },
  { name: "Bed Sheet", description: "Bed sheet", price: "5.00", category: "Bedding", stockQuantity: 100, sku: "BEDS-001" },
  { name: "Duvet Cover", description: "Duvet/comforter cover", price: "10.00", category: "Bedding", stockQuantity: 100, sku: "DUVE-001" },
  { name: "Towel", description: "Bath/hand towel", price: "5.00", category: "Bathroom", stockQuantity: 100, sku: "TOWE-001" },
  { name: "Blanket", description: "Blanket", price: "20.00", category: "Bedding", stockQuantity: 100, sku: "BLAN-001" },
  { name: "Comfort (Small)", description: "Small comforter/duvet", price: "25.00", category: "Bedding", stockQuantity: 100, sku: "COMF-001" },
  { name: "Comfort (Large)", description: "Large comforter/duvet", price: "35.00", category: "Bedding", stockQuantity: 100, sku: "COMF-002" },
  { name: "Curtain/Window Screen", description: "Window curtains", price: "20.00", category: "Home Linens", stockQuantity: 100, sku: "CURT-001" },
  { name: "Carpet (per SQ MTR)", description: "Carpet cleaning per square meter", price: "12.00", category: "Flooring", stockQuantity: 100, sku: "CARP-001" },
  { name: "Shoes", description: "Shoe cleaning", price: "10.00", category: "Footwear", stockQuantity: 100, sku: "SHOE-001" }
];

export async function seedDatabase() {
  console.log("Checking and seeding database...");
  
  // Always ensure all 43 laundry items exist - delete old products and insert new ones
  const existingProducts = await storage.getProducts();
  
  // Check if we have the correct products (by checking for a known item)
  const hasCorrectProducts = existingProducts.some(p => p.name === "Kandoora/Thob");
  
  if (!hasCorrectProducts || existingProducts.length < 43) {
    console.log("Reseeding products with 43 laundry items...");
    
    // Delete all existing products
    await db.delete(products);
    
    // Insert all 43 laundry items
    for (const item of laundryItems) {
      await storage.createProduct(item);
    }
    
    console.log("Seeded 43 laundry items successfully.");
  } else {
    console.log(`Products already seeded: ${existingProducts.length} items found.`);
  }

  // Seed clients if empty
  const existingClients = await storage.getClients();
  if (existingClients.length === 0) {
    console.log("Seeding clients...");
    
    const clientsData = [
      {
        name: "Abdullah",
        address: "",
        amount: "11.00",
        deposit: "11.00",
        balance: "0.00",
        contact: "http://wa.me/+971543956492",
        billNumber: ""
      },
      {
        name: "Ahmed Al-Mansouri",
        address: "Dubai, UAE",
        amount: "150.00",
        deposit: "50.00",
        balance: "100.00",
        contact: "http://wa.me/+971501234567",
        billNumber: "BL-2024-001"
      },
      {
        name: "Fatima Al-Ketbi",
        address: "Abu Dhabi, UAE",
        amount: "275.50",
        deposit: "100.00",
        balance: "175.50",
        contact: "http://wa.me/+971507654321",
        billNumber: "BL-2024-002"
      },
      {
        name: "Mohammed Al-Falahi",
        address: "Sharjah, UAE",
        amount: "89.75",
        deposit: "25.00",
        balance: "64.75",
        contact: "http://wa.me/+971509876543",
        billNumber: "BL-2024-003"
      }
    ];

    for (const client of clientsData) {
      await storage.createClient(client);
    }
    console.log("Seeding complete.");
  }

  // Seed default users if none exist
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    console.log("Seeding default users...");
    
    const defaultUsers = [
      { username: "admin", password: "admin123", role: "admin", name: "Administrator", active: true },
      { username: "manager", password: "manager123", role: "manager", name: "Manager", active: true },
      { username: "cashier", password: "cashier123", role: "cashier", name: "Cashier", active: true },
    ];

    for (const user of defaultUsers) {
      await db.insert(users).values(user);
    }
    console.log("Default users created: admin, manager, cashier");
  }

  // Seed default packing/delivery workers if none exist
  const existingWorkers = await db.select().from(packingWorkers);
  if (existingWorkers.length === 0) {
    console.log("Seeding default workers...");
    
    const hashedPin = await bcrypt.hash("12345", 10);
    await db.insert(packingWorkers).values({
      name: "Delivery Driver",
      pin: hashedPin,
      active: true
    });
    console.log("Default delivery worker created with PIN: 12345");
  }
}
