import { pgTable, text, integer, real, boolean, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price"),
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
  phoneModified: boolean("phone_modified").default(false),
  amount: real("amount").default(0),
  deposit: real("deposit").default(0),
  balance: real("balance").default(0),
  notes: text("notes"),
  billNumber: text("bill_number"),
  preferredPaymentMethod: text("preferred_payment_method").default("cash"),
  discountPercent: real("discount_percent").default(0),
});

export const clientTransactions = pgTable("client_transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  billId: integer("bill_id"),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  runningBalance: real("running_balance").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  discount: real("discount").default(0),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  amount: real("amount").notNull(),
  paidAmount: real("paid_amount").default(0),
  description: text("description"),
  billDate: text("bill_date").notNull(),
  referenceNumber: text("reference_number"),
  isPaid: boolean("is_paid").default(false),
  createdByWorkerId: integer("created_by_worker_id"),
});

export const billPayments = pgTable("bill_payments", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull(),
  clientId: integer("client_id").notNull(),
  amount: real("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  notes: text("notes"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  billId: integer("bill_id"),
  customerName: text("customer_name"),
  orderNumber: text("order_number").notNull(),
  items: text("items"),
  totalAmount: real("total_amount").notNull(),
  paidAmount: real("paid_amount").default(0),
  discountPercent: real("discount_percent").default(0),
  discountAmount: real("discount_amount").default(0),
  finalAmount: real("final_amount"),
  paymentMethod: text("payment_method").default("cash"),
  paymentOption: text("payment_option").default("pay_later"),
  status: text("status").default("entry"),
  orderType: text("order_type").default("regular"),
  deliveryType: text("delivery_type").default("takeaway"),
  expectedDeliveryAt: text("expected_delivery_at"),
  entryDate: text("entry_date").notNull(),
  entryBy: text("entry_by"),
  tagDone: boolean("tag_done").default(false),
  tagDate: text("tag_date"),
  tagBy: text("tag_by"),
  tagWorkerId: integer("tag_worker_id"),
  washingDone: boolean("washing_done").default(false),
  washingDate: text("washing_date"),
  washingBy: text("washing_by"),
  packingDone: boolean("packing_done").default(false),
  packingDate: text("packing_date"),
  packingBy: text("packing_by"),
  packingWorkerId: integer("packing_worker_id"),
  delivered: boolean("delivered").default(false),
  deliveryDate: text("delivery_date"),
  deliveryBy: text("delivery_by"),
  deliveredByWorkerId: integer("delivered_by_worker_id"),
  notes: text("notes"),
  urgent: boolean("urgent").default(false),
  publicViewToken: text("public_view_token"),
  tips: real("tips").default(0),
  deliveryPhoto: text("delivery_photo"),
  deliveryPhotos: text("delivery_photos"),
  stockDeducted: boolean("stock_deducted").default(false),
  itemCountVerified: boolean("item_count_verified").default(false),
  verifiedAt: text("verified_at"),
  verifiedByWorkerId: integer("verified_by_worker_id"),
  verifiedByWorkerName: text("verified_by_worker_name"),
  itemCountAtIntake: integer("item_count_at_intake"),
  itemCountAtRelease: integer("item_count_at_release"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  pin: text("pin").notNull().default("12345"),
  role: text("role").notNull().default("cashier"),
  name: text("name"),
  email: text("email"),
  active: boolean("active").default(true),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
  used: boolean("used").default(false),
});

export const packingWorkers = pgTable("packing_workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  active: boolean("active").default(true),
});

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  orderId: integer("order_id"),
  orderNumber: text("order_number"),
  itemName: text("item_name"),
  reason: text("reason").notNull(),
  notes: text("notes"),
  refundAmount: real("refund_amount").default(0),
  itemValue: real("item_value").default(0),
  responsibleStaffId: integer("responsible_staff_id"),
  responsibleStaffName: text("responsible_staff_name"),
  reporterName: text("reporter_name"),
  incidentType: text("incident_type").default("refund"),
  incidentStage: text("incident_stage").default("delivery"),
  status: text("status").default("open"),
  incidentDate: text("incident_date").notNull(),
  resolvedDate: text("resolved_date"),
  resolution: text("resolution"),
});

export const missingItems = pgTable("missing_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"),
  orderNumber: text("order_number"),
  customerName: text("customer_name"),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").default(1),
  itemValue: real("item_value").default(0),
  stage: text("stage").notNull(),
  responsibleWorkerId: integer("responsible_worker_id"),
  responsibleWorkerName: text("responsible_worker_name"),
  reportedByWorkerId: integer("reported_by_worker_id"),
  reportedByWorkerName: text("reported_by_worker_name"),
  notes: text("notes"),
  status: text("status").default("reported"),
  reportedAt: text("reported_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolution: text("resolution"),
});

export const stageChecklists = pgTable("stage_checklists", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  stage: text("stage").notNull(),
  checkedItems: text("checked_items"),
  totalItems: integer("total_items").notNull(),
  checkedCount: integer("checked_count").default(0),
  isComplete: boolean("is_complete").default(false),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  workerId: integer("worker_id"),
  workerName: text("worker_name"),
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
    billId: z.number().optional().nullable(),
    customerName: z.string().optional(),
    entryDate: z.union([z.date(), z.string()]),
    expectedDeliveryAt: z.union([z.date(), z.string()]).optional().nullable(),
    tagDate: z.union([z.date(), z.string()]).optional().nullable(),
    washingDate: z.union([z.date(), z.string()]).optional().nullable(),
    packingDate: z.union([z.date(), z.string()]).optional().nullable(),
    deliveryDate: z.union([z.date(), z.string()]).optional().nullable(),
    packingWorkerId: z.number().optional().nullable(),
  });

export const insertIncidentSchema = createInsertSchema(incidents)
  .omit({ id: true })
  .extend({
    customerName: z.string().min(1, "Customer name is required"),
    reason: z.string().min(1, "Reason is required"),
    refundAmount: z.union([z.string(), z.number()]).optional(),
    itemValue: z.union([z.string(), z.number()]).optional(),
    incidentDate: z.union([z.date(), z.string()]),
    resolvedDate: z.union([z.date(), z.string()]).optional().nullable(),
  });

export const insertMissingItemSchema = createInsertSchema(missingItems)
  .omit({ id: true })
  .extend({
    itemName: z.string().min(1, "Item name is required"),
    stage: z.string().min(1, "Stage is required"),
    quantity: z.number().optional(),
    itemValue: z.union([z.string(), z.number()]).optional(),
    reportedAt: z.union([z.date(), z.string()]),
    resolvedAt: z.union([z.date(), z.string()]).optional().nullable(),
  });

export const insertStageChecklistSchema = createInsertSchema(stageChecklists)
  .omit({ id: true })
  .extend({
    orderId: z.number(),
    stage: z.string().min(1, "Stage is required"),
    totalItems: z.number(),
    checkedItems: z.string().optional(),
    startedAt: z.union([z.date(), z.string()]).optional().nullable(),
    completedAt: z.union([z.date(), z.string()]).optional().nullable(),
  });

export type Product = typeof products.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type BillPayment = typeof billPayments.$inferSelect;
export type ClientTransaction = typeof clientTransactions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PackingWorker = typeof packingWorkers.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPackingWorker = z.infer<typeof insertPackingWorkerSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type MissingItem = typeof missingItems.$inferSelect;
export type InsertMissingItem = z.infer<typeof insertMissingItemSchema>;
export type StageChecklist = typeof stageChecklists.$inferSelect;
export type InsertStageChecklist = z.infer<typeof insertStageChecklistSchema>;

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