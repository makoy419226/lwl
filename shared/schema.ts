import { pgTable, text, serial, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }),
  sku: text("sku"),
  category: text("category").default("Laundry"),
  stockQuantity: integer("stock_quantity").default(0),
  imageUrl: text("image_url"),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  address: text("address"),
  phone: text("phone"),
  amount: numeric("amount", { precision: 12, scale: 2 }).default("0"),
  deposit: numeric("deposit", { precision: 12, scale: 2 }).default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0"),
  contact: text("contact"),
  billNumber: text("bill_number"),
  preferredPaymentMethod: text("preferred_payment_method").default("cash"), // 'cash', 'card', 'bank'
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
});

export const clientTransactions = pgTable("client_transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  type: text("type").notNull(), // 'bill' or 'deposit'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  runningBalance: numeric("running_balance", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("cash"), // 'cash', 'card', 'bank'
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0"),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0"),
  description: text("description"),
  billDate: timestamp("bill_date").notNull(),
  referenceNumber: text("reference_number"),
  isPaid: boolean("is_paid").default(false),
});

export const billPayments = pgTable("bill_payments", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull(),
  clientId: integer("client_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  notes: text("notes"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  customerName: text("customer_name"),
  orderNumber: text("order_number").notNull(),
  items: text("items"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  finalAmount: numeric("final_amount", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method").default("cash"), // 'cash', 'card', 'bank'
  status: text("status").default("entry"),
  deliveryType: text("delivery_type").default("takeaway"),
  expectedDeliveryAt: timestamp("expected_delivery_at"),
  entryDate: timestamp("entry_date").notNull(),
  entryBy: text("entry_by"),
  washingDone: boolean("washing_done").default(false),
  washingDate: timestamp("washing_date"),
  washingBy: text("washing_by"),
  packingDone: boolean("packing_done").default(false),
  packingDate: timestamp("packing_date"),
  packingBy: text("packing_by"),
  packingWorkerId: integer("packing_worker_id"),
  delivered: boolean("delivered").default(false),
  deliveryDate: timestamp("delivery_date"),
  deliveryBy: text("delivery_by"),
  deliveredByWorkerId: integer("delivered_by_worker_id"),
  notes: text("notes"),
  urgent: boolean("urgent").default(false),
  publicViewToken: text("public_view_token"),
  tips: numeric("tips", { precision: 12, scale: 2 }).default("0"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("cashier"), // 'admin', 'manager', 'cashier'
  name: text("name"),
  active: boolean("active").default(true),
});

export const packingWorkers = pgTable("packing_workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").notNull(), // 5-digit PIN
  active: boolean("active").default(true),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients)
  .omit({ id: true })
  .extend({
    name: z.string().min(1, "Client name is required"),
    phone: z.string().min(1, "Phone number is required"),
    address: z.string().min(1, "Address is required"),
    amount: z.union([z.string(), z.number()]).optional(),
    deposit: z.union([z.string(), z.number()]).optional(),
    balance: z.union([z.string(), z.number()]).optional(),
  });
export const insertBillSchema = createInsertSchema(bills)
  .omit({ id: true })
  .extend({
    amount: z.union([z.string(), z.number()]),
    paidAmount: z.union([z.string(), z.number()]).optional(),
    clientId: z.number().optional().nullable(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    billDate: z.union([z.date(), z.string()]),
  });
export const insertBillPaymentSchema = createInsertSchema(billPayments)
  .omit({ id: true })
  .extend({
    amount: z.union([z.string(), z.number()]),
    billId: z.number(),
    clientId: z.number(),
    paymentDate: z.union([z.date(), z.string()]),
  });
export const insertTransactionSchema = createInsertSchema(clientTransactions)
  .omit({ id: true })
  .extend({
    amount: z.union([z.string(), z.number()]),
    runningBalance: z.union([z.string(), z.number()]),
    date: z.union([z.date(), z.string()]),
  });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertPackingWorkerSchema = createInsertSchema(packingWorkers)
  .omit({ id: true })
  .extend({
    pin: z.string().length(5, "PIN must be exactly 5 digits").regex(/^\d{5}$/, "PIN must be 5 digits"),
  });
export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true })
  .extend({
    totalAmount: z.union([z.string(), z.number()]),
    paidAmount: z.union([z.string(), z.number()]).optional(),
    clientId: z.number().optional().nullable(),
    customerName: z.string().optional(),
    entryDate: z.union([z.date(), z.string()]),
    expectedDeliveryAt: z.union([z.date(), z.string()]).optional().nullable(),
    washingDate: z.union([z.date(), z.string()]).optional().nullable(),
    packingDate: z.union([z.date(), z.string()]).optional().nullable(),
    deliveryDate: z.union([z.date(), z.string()]).optional().nullable(),
    packingWorkerId: z.number().optional().nullable(),
  });

export type Product = typeof products.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type BillPayment = typeof billPayments.$inferSelect;
export type ClientTransaction = typeof clientTransactions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PackingWorker = typeof packingWorkers.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPackingWorker = z.infer<typeof insertPackingWorkerSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// Explicit API types
export type ProductResponse = Product;
export type CreateProductRequest = InsertProduct;
export type UpdateProductRequest = Partial<InsertProduct>;
export type ClientResponse = Client;
export type CreateClientRequest = InsertClient;
export type UpdateClientRequest = Partial<InsertClient>;
export type BillResponse = Bill;
export type CreateBillRequest = InsertBill;
export type UpdateBillRequest = Partial<InsertBill>;
export type TransactionResponse = ClientTransaction;
export type CreateTransactionRequest = InsertTransaction;
export type OrderResponse = Order;
export type CreateOrderRequest = InsertOrder;
export type UpdateOrderRequest = Partial<InsertOrder>;
