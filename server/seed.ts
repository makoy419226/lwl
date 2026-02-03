import { db } from "./db";
import { products, clients, users, packingWorkers } from "@shared/schema";
import { storage } from "./storage";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const laundryItems = [
  // Arabic Clothes
  {
    name: "Kandoora/Thob",
    description: "Traditional men's robe",
    price: "8.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "KAN-001",
  },
  {
    name: "Ghutra",
    description: "Traditional head covering",
    price: "5.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "GHU-001",
  },
  {
    name: "Agal",
    description: "Traditional head rope",
    price: "3.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "AGA-001",
  },
  {
    name: "Bisht",
    description: "Traditional cloak",
    price: "25.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "BIS-001",
  },
  {
    name: "Abaya",
    description: "Traditional ladies robe",
    price: "12.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "ABA-001",
  },
  {
    name: "Shela",
    description: "Traditional scarf/shawl",
    price: "5.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "SHE-001",
  },
  {
    name: "Jalabiya",
    description: "Traditional loose dress",
    price: "10.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "JAL-001",
  },
  {
    name: "Niqab",
    description: "Face veil",
    price: "4.00",
    category: "Arabic Clothes",
    stockQuantity: 0,
    sku: "NIQ-001",
  },
  
  // Men's Clothes
  {
    name: "Shirt/Blouse",
    description: "Formal shirt or blouse",
    price: "4.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "SHI-001",
  },
  {
    name: "T-Shirt",
    description: "T-shirt wash or dry clean",
    price: "3.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "TSH-001",
  },
  {
    name: "Jeans Pant/Trouser",
    description: "Jeans or trousers",
    price: "4.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "JEA-001",
  },
  {
    name: "Track Pant",
    description: "Track pant wash or dry clean",
    price: "4.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "TRA-001",
  },
  {
    name: "Jacket",
    description: "Jacket",
    price: "8.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "JAC-001",
  },
  {
    name: "Sweater",
    description: "Sweater/pullover",
    price: "6.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "SWE-001",
  },
  {
    name: "Short",
    description: "Shorts",
    price: "3.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "SHO-001",
  },
  {
    name: "Suit/Coat",
    description: "Suit or coat wash or dry clean",
    price: "30.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "SUI-001",
  },
  {
    name: "Polo Shirt",
    description: "Polo shirt wash",
    price: "4.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "POL-001",
  },
  {
    name: "Hoodie",
    description: "Hooded sweatshirt",
    price: "7.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "HOO-001",
  },
  {
    name: "Formal Pants",
    description: "Formal dress pants",
    price: "5.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "FOR-001",
  },
  {
    name: "Wezar/Lungi",
    description: "Traditional wrap garment",
    price: "4.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "WEZ-001",
  },
  {
    name: "Fanela/Vest",
    description: "Undershirt/vest",
    price: "2.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "FAN-001",
  },
  {
    name: "Underwear",
    description: "Undergarment",
    price: "2.00",
    category: "Men's Clothes",
    stockQuantity: 0,
    sku: "UND-001",
  },
  
  // Ladies' Clothes
  {
    name: "Ladies Bras",
    description: "Ladies undergarment",
    price: "3.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "BRA-001",
  },
  {
    name: "Ladies Suit",
    description: "Ladies formal suit",
    price: "15.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "LAD-001",
  },
  {
    name: "Saree",
    description: "Traditional Indian garment",
    price: "45.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "SAR-001",
  },
  {
    name: "Salawar Qamees",
    description: "Traditional outfit",
    price: "8.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "SAL-001",
  },
  {
    name: "Ladies Pusthan",
    description: "Traditional ladies dress",
    price: "12.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "PUS-001",
  },
  {
    name: "Party Dress (Female)",
    description: "Ladies party dress",
    price: "30.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "PAR-001",
  },
  {
    name: "Skirt",
    description: "Ladies skirt",
    price: "5.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "SKI-001",
  },
  {
    name: "Blouse",
    description: "Ladies blouse",
    price: "4.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "BLO-001",
  },
  {
    name: "Evening Gown",
    description: "Formal evening dress",
    price: "50.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "EVE-001",
  },
  {
    name: "Kaftan",
    description: "Traditional loose dress",
    price: "15.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "KAF-001",
  },
  {
    name: "Lehenga",
    description: "Traditional Indian skirt outfit",
    price: "60.00",
    category: "Ladies' Clothes",
    stockQuantity: 0,
    sku: "LEH-001",
  },
  
  // Baby Clothes
  {
    name: "Baby T-Shirt",
    description: "Baby t-shirt wash",
    price: "2.00",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-001",
  },
  {
    name: "Baby Pant",
    description: "Baby pant wash",
    price: "2.00",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-002",
  },
  {
    name: "Baby Cloth",
    description: "Baby cloth wash",
    price: "2.00",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-003",
  },
  {
    name: "Baby Dress",
    description: "Baby dress wash",
    price: "3.00",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-004",
  },
  {
    name: "Baby Romper",
    description: "Baby one-piece outfit",
    price: "2.50",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-005",
  },
  {
    name: "Baby Blanket",
    description: "Baby blanket wash",
    price: "5.00",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-006",
  },
  {
    name: "Baby Jacket",
    description: "Baby jacket wash",
    price: "3.00",
    category: "Baby Clothes",
    stockQuantity: 0,
    sku: "BAB-007",
  },
  
  // Linens
  {
    name: "Pillow Cover",
    description: "Pillow case cover",
    price: "3.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "PIL-001",
  },
  {
    name: "Pillow",
    description: "Full pillow cleaning",
    price: "8.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "PIL-002",
  },
  {
    name: "Bed Sheet (Single)",
    description: "Single bed sheet",
    price: "6.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "BED-001",
  },
  {
    name: "Bed Sheet (Double)",
    description: "Double bed sheet",
    price: "8.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "BED-002",
  },
  {
    name: "Bed Sheet (King)",
    description: "King size bed sheet",
    price: "10.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "BED-003",
  },
  {
    name: "Duvet Cover",
    description: "Duvet/comforter cover",
    price: "12.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "DUV-001",
  },
  {
    name: "Towel (Small)",
    description: "Hand towel",
    price: "3.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "TOW-001",
  },
  {
    name: "Towel (Large)",
    description: "Bath towel",
    price: "5.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "TOW-002",
  },
  {
    name: "Blanket (Single)",
    description: "Single blanket",
    price: "20.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "BLA-001",
  },
  {
    name: "Blanket (Double)",
    description: "Double blanket",
    price: "30.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "BLA-002",
  },
  {
    name: "Comforter (Small)",
    description: "Small comforter/duvet",
    price: "30.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "COM-001",
  },
  {
    name: "Comforter (Large)",
    description: "Large comforter/duvet",
    price: "40.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "COM-002",
  },
  {
    name: "Table Cloth (Small)",
    description: "Small table cloth",
    price: "6.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "TAB-001",
  },
  {
    name: "Table Cloth (Large)",
    description: "Large table cloth",
    price: "10.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "TAB-002",
  },
  {
    name: "Curtain (per meter)",
    description: "Window curtains per meter",
    price: "8.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "CUR-001",
  },
  {
    name: "Mattress Cover",
    description: "Mattress protector cover",
    price: "15.00",
    category: "Linens",
    stockQuantity: 0,
    sku: "MAT-001",
  },
  
  // Shop Items
  {
    name: "Detergent (1kg)",
    description: "Laundry detergent powder",
    price: "15.00",
    category: "Shop Items",
    stockQuantity: 50,
    sku: "DET-001",
  },
  {
    name: "Fabric Softener",
    description: "Fabric softener liquid",
    price: "12.00",
    category: "Shop Items",
    stockQuantity: 40,
    sku: "FAB-001",
  },
  {
    name: "Stain Remover",
    description: "Stain remover spray",
    price: "18.00",
    category: "Shop Items",
    stockQuantity: 30,
    sku: "STA-001",
  },
  {
    name: "Hanger (Pack of 10)",
    description: "Plastic hangers",
    price: "10.00",
    category: "Shop Items",
    stockQuantity: 100,
    sku: "HAN-001",
  },
  {
    name: "Laundry Bag",
    description: "Mesh laundry bag",
    price: "8.00",
    category: "Shop Items",
    stockQuantity: 60,
    sku: "LAU-001",
  },
  {
    name: "Ironing Spray",
    description: "Ironing spray starch",
    price: "10.00",
    category: "Shop Items",
    stockQuantity: 45,
    sku: "IRO-001",
  },
  
  // General Items
  {
    name: "Coveral",
    description: "Full body coverall",
    price: "10.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "COV-001",
  },
  {
    name: "Military Dress",
    description: "Military uniform",
    price: "15.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "MIL-001",
  },
  {
    name: "Party Dress (Male)",
    description: "Men's party dress",
    price: "30.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "PAR-002",
  },
  {
    name: "Socks (pair)",
    description: "Pair of socks",
    price: "2.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "SOC-001",
  },
  {
    name: "Cap/Hat",
    description: "Head cap or hat",
    price: "3.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "CAP-001",
  },
  {
    name: "Tie",
    description: "Necktie",
    price: "4.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "TIE-001",
  },
  {
    name: "Scarf",
    description: "Fashion scarf",
    price: "5.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "SCA-001",
  },
  {
    name: "Gloves (pair)",
    description: "Pair of gloves",
    price: "4.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "GLO-001",
  },
  {
    name: "Belt",
    description: "Leather belt cleaning",
    price: "5.00",
    category: "General Items",
    stockQuantity: 0,
    sku: "BEL-001",
  },
  
  // Shoes, Carpets & More
  {
    name: "Shoes (Regular)",
    description: "Regular shoe cleaning",
    price: "15.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "SHO-001",
  },
  {
    name: "Shoes (Premium)",
    description: "Premium shoe cleaning & polish",
    price: "25.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "SHO-002",
  },
  {
    name: "Sandals",
    description: "Sandal cleaning",
    price: "10.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "SAN-001",
  },
  {
    name: "Boots",
    description: "Boot cleaning",
    price: "20.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "BOO-001",
  },
  {
    name: "Sneakers",
    description: "Sneaker cleaning",
    price: "18.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "SNE-001",
  },
  {
    name: "Carpet (per SQ MTR)",
    description: "Carpet cleaning per square meter",
    price: "15.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "CAR-001",
  },
  {
    name: "Rug (Small)",
    description: "Small rug cleaning",
    price: "25.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "RUG-001",
  },
  {
    name: "Rug (Medium)",
    description: "Medium rug cleaning",
    price: "40.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "RUG-002",
  },
  {
    name: "Rug (Large)",
    description: "Large rug cleaning",
    price: "60.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "RUG-003",
  },
  {
    name: "Prayer Mat",
    description: "Prayer mat cleaning",
    price: "8.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "PRA-001",
  },
  {
    name: "Bag/Purse",
    description: "Bag or purse cleaning",
    price: "20.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "BAG-001",
  },
  {
    name: "Leather Jacket",
    description: "Leather jacket cleaning",
    price: "35.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "LEA-001",
  },
  {
    name: "Sofa Cover (per seat)",
    description: "Sofa cover per seat",
    price: "12.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "SOF-001",
  },
  {
    name: "Car Seat Cover",
    description: "Car seat cover cleaning",
    price: "15.00",
    category: "Shoes, Carpets & More",
    stockQuantity: 0,
    sku: "CAR-002",
  },
];

export async function seedDatabase() {
  console.log("Checking and seeding database...");

  // Always ensure all laundry items exist - delete old products and insert new ones
  const existingProducts = await storage.getProducts();

  // Check if we have the correct products with updated categories
  const hasCorrectCategories = existingProducts.some(
    (p) => p.category === "Arabic Clothes",
  );

  if (!hasCorrectCategories || existingProducts.length < 80) {
    console.log("Reseeding products with updated UAE laundry items...");

    // Delete all existing products
    await db.delete(products);

    // Insert all laundry items
    for (const item of laundryItems) {
      await storage.createProduct(item);
    }

    console.log(`Seeded ${laundryItems.length} laundry items successfully.`);
  } else {
    console.log(
      `Products already seeded: ${existingProducts.length} items found.`,
    );
  }


  // Seed default users if none exist
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    console.log("Seeding default users...");

    const defaultUsers = [
      {
        username: "admin",
        password: "admin123",
        role: "admin",
        name: "Administrator",
        pin: "00000",
        active: true,
      },
      {
        username: "counter1",
        password: "counter123",
        role: "counter",
        name: "CounterUsername",
        pin: "11111",
        active: true,
      },
      {
        username: "section1",
        password: "section123",
        role: "section",
        name: "SectionUsername",
        pin: "22222",
        active: true,
      },
      {
        username: "driver1",
        password: "driver123",
        role: "driver",
        name: "DriverUsername",
        pin: "33333",
        active: true,
      },
    ];

    for (const user of defaultUsers) {
      await db.insert(users).values(user);
    }
    console.log("Default users created: admin, counter1, section1, driver1");
  }

  // No default packing workers - staff users handle packing by default
}

// Export default users for reset functionality
export const defaultUsers = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Administrator",
    pin: "00000",
    active: true,
  },
  {
    username: "counter1",
    password: "counter123",
    role: "counter",
    name: "CounterUsername",
    pin: "11111",
    active: true,
  },
  {
    username: "section1",
    password: "section123",
    role: "section",
    name: "SectionUsername",
    pin: "22222",
    active: true,
  },
  {
    username: "driver1",
    password: "driver123",
    role: "driver",
    name: "DriverUsername",
    pin: "33333",
    active: true,
  },
];
