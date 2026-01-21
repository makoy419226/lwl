import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price"),
  sku: text("sku"),
  category: text("category").default("Laundry"),
  stockQuantity: integer("stock_quantity").default(0),
  imageUrl: text("image_url"),
});

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  address: text("address"),
  phone: text("phone"),
  phoneModified: integer("phone_modified", { mode: "boolean" }).default(false),
  amount: real("amount").default(0),
  deposit: real("deposit").default(0),
  balance: real("balance").default(0),
  notes: text("notes"),
  billNumber: text("bill_number"),
  preferredPaymentMethod: text("preferred_payment_method").default("cash"),
  discountPercent: real("discount_percent").default(0),
});

export const clientTransactions = sqliteTable("client_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const bills = sqliteTable("bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  amount: real("amount").notNull(),
  paidAmount: real("paid_amount").default(0),
  description: text("description"),
  billDate: text("bill_date").notNull(),
  referenceNumber: text("reference_number"),
  isPaid: integer("is_paid", { mode: "boolean" }).default(false),
  createdByWorkerId: integer("created_by_worker_id"),
});

export const billPayments = sqliteTable("bill_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  billId: integer("bill_id").notNull(),
  clientId: integer("client_id").notNull(),
  amount: real("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  notes: text("notes"),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  status: text("status").default("entry"),
  deliveryType: text("delivery_type").default("takeaway"),
  expectedDeliveryAt: text("expected_delivery_at"),
  entryDate: text("entry_date").notNull(),
  entryBy: text("entry_by"),
  tagDone: integer("tag_done", { mode: "boolean" }).default(false),
  tagDate: text("tag_date"),
  tagBy: text("tag_by"),
  tagWorkerId: integer("tag_worker_id"),
  washingDone: integer("washing_done", { mode: "boolean" }).default(false),
  washingDate: text("washing_date"),
  washingBy: text("washing_by"),
  packingDone: integer("packing_done", { mode: "boolean" }).default(false),
  packingDate: text("packing_date"),
  packingBy: text("packing_by"),
  packingWorkerId: integer("packing_worker_id"),
  delivered: integer("delivered", { mode: "boolean" }).default(false),
  deliveryDate: text("delivery_date"),
  deliveryBy: text("delivery_by"),
  deliveredByWorkerId: integer("delivered_by_worker_id"),
  notes: text("notes"),
  urgent: integer("urgent", { mode: "boolean" }).default(false),
  publicViewToken: text("public_view_token"),
  tips: real("tips").default(0),
  deliveryPhoto: text("delivery_photo"),
  deliveryPhotos: text("delivery_photos"),
  stockDeducted: integer("stock_deducted", { mode: "boolean" }).default(false),
  itemCountVerified: integer("item_count_verified", { mode: "boolean" }).default(false),
  verifiedAt: text("verified_at"),
  verifiedByWorkerId: integer("verified_by_worker_id"),
  verifiedByWorkerName: text("verified_by_worker_name"),
  itemCountAtIntake: integer("item_count_at_intake"),
  itemCountAtRelease: integer("item_count_at_release"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  pin: text("pin").notNull().default("12345"),
  role: text("role").notNull().default("cashier"),
  name: text("name"),
  email: text("email"),
  active: integer("active", { mode: "boolean" }).default(true),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
  used: integer("used", { mode: "boolean" }).default(false),
});

export const packingWorkers = sqliteTable("packing_workers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
});

export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const missingItems = sqliteTable("missing_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const stageChecklists = sqliteTable("stage_checklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  stage: text("stage").notNull(),
  checkedItems: text("checked_items"),
  totalItems: integer("total_items").notNull(),
  checkedCount: integer("checked_count").default(0),
  isComplete: integer("is_complete", { mode: "boolean" }).default(false),
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