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
  address: text("address"),
  phone: text("phone"),
  amount: numeric("amount", { precision: 12, scale: 2 }).default("0"),
  deposit: numeric("deposit", { precision: 12, scale: 2 }).default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0"),
  contact: text("contact"),
  billNumber: text("bill_number"),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  billDate: timestamp("bill_date").notNull(),
  referenceNumber: text("reference_number"),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients)
  .omit({ id: true })
  .extend({
    amount: z.union([z.string(), z.number()]).optional(),
    deposit: z.union([z.string(), z.number()]).optional(),
    balance: z.union([z.string(), z.number()]).optional(),
  });
export const insertBillSchema = createInsertSchema(bills)
  .omit({ id: true })
  .extend({
    amount: z.union([z.string(), z.number()]),
    clientId: z.number(),
    billDate: z.union([z.date(), z.string()]),
  });

export type Product = typeof products.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBill = z.infer<typeof insertBillSchema>;

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
