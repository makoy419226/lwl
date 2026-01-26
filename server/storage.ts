import { db } from "./db";
import bcrypt from "bcryptjs";
import {
  products,
  clients,
  bills,
  billPayments,
  clientTransactions,
  orders,
  packingWorkers,
  incidents,
  missingItems,
  users,
  type Product,
  type Client,
  type Bill,
  type BillPayment,
  type ClientTransaction,
  type Order,
  type PackingWorker,
  type Incident,
  type MissingItem,
  type InsertProduct,
  type InsertClient,
  type InsertBill,
  type InsertBillPayment,
  type InsertTransaction,
  type InsertOrder,
  type InsertPackingWorker,
  type InsertIncident,
  type InsertMissingItem,
  type UpdateProductRequest,
  type UpdateClientRequest,
  type UpdateOrderRequest,
  type User,
} from "@shared/schema";
import { eq, ilike, or, desc, and, inArray, sql } from "drizzle-orm";

export interface IStorage {
  getProducts(search?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getClients(search?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  findClientByNameAndPhone(
    name: string,
    phone: string,
    excludeId?: number,
  ): Promise<Client | undefined>;
  findClientByNameAndAddress(
    name: string,
    address: string,
    excludeId?: number,
  ): Promise<Client | undefined>;
  findClientByPhone(
    phone: string,
    excludeId?: number,
  ): Promise<Client | undefined>;
  findClientByName(
    name: string,
    excludeId?: number,
  ): Promise<Client | undefined>;
  findClientByAddress(
    address: string,
    excludeId?: number,
  ): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: UpdateClientRequest): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  getBills(): Promise<Bill[]>;
  getBill(id: number): Promise<Bill | undefined>;
  getClientBills(clientId: number): Promise<Bill[]>;
  getUnpaidBills(clientId: number): Promise<Bill[]>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(
    id: number,
    updates: Partial<InsertBill> & { isPaid?: boolean },
  ): Promise<Bill>;
  deleteBill(id: number): Promise<void>;
  getBillPayments(billId: number): Promise<BillPayment[]>;
  getAllBillPayments(): Promise<BillPayment[]>;
  getClientBillPayments(clientId: number): Promise<BillPayment[]>;
  createBillPayment(payment: InsertBillPayment): Promise<BillPayment>;
  payBill(
    billId: number,
    amount: string,
    paymentMethod?: string,
    notes?: string,
    processedBy?: string,
  ): Promise<{ bill: Bill; payment: BillPayment }>;
  getClientTransactions(clientId: number): Promise<ClientTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<ClientTransaction>;
  updateClientTransaction(
    transactionId: number,
    data: { amount: string; description: string },
  ): Promise<ClientTransaction>;
  addClientBill(
    clientId: number,
    amount: string,
    description?: string,
  ): Promise<ClientTransaction>;
  addClientDeposit(
    clientId: number,
    amount: string,
    description?: string,
  ): Promise<ClientTransaction>;
  deleteClientTransaction(transactionId: number): Promise<void>;
  getOrders(search?: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByPublicToken(token: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getDeliveredOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: UpdateOrderRequest): Promise<Order>;
  deleteOrder(id: number): Promise<void>;
  deleteAllOrders(): Promise<void>;
  deleteAllTransactions(): Promise<void>;
  deleteAllBills(): Promise<void>;
  deleteAllClients(): Promise<void>;
  getPackingWorkers(): Promise<PackingWorker[]>;
  getPackingWorker(id: number): Promise<PackingWorker | undefined>;
  createPackingWorker(worker: InsertPackingWorker): Promise<PackingWorker>;
  updatePackingWorker(
    id: number,
    updates: Partial<InsertPackingWorker>,
  ): Promise<PackingWorker>;
  deletePackingWorker(id: number): Promise<void>;
  verifyPackingWorkerPin(pin: string): Promise<PackingWorker | null>;
  verifyDeliveryWorkerPin(pin: string): Promise<PackingWorker | null>;
  verifyUserPin(pin: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getClientOrders(clientId: number): Promise<Order[]>;
  getIncidents(search?: string): Promise<Incident[]>;
  getIncident(id: number): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(
    id: number,
    updates: Partial<InsertIncident>,
  ): Promise<Incident>;
  deleteIncident(id: number): Promise<void>;
  getAllocatedStock(): Promise<Record<string, number>>;
  addStockForOrder(orderId: number): Promise<void>;
  deductStockForOrder(orderId: number): Promise<void>;
  getMissingItems(search?: string): Promise<MissingItem[]>;
  getMissingItem(id: number): Promise<MissingItem | undefined>;
  createMissingItem(item: InsertMissingItem): Promise<MissingItem>;
  updateMissingItem(
    id: number,
    updates: Partial<InsertMissingItem>,
  ): Promise<MissingItem>;
  deleteMissingItem(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(search?: string): Promise<Product[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db
        .select()
        .from(products)
        .where(
          or(
            ilike(products.name, searchPattern),
            ilike(products.description || "", searchPattern),
          ),
        );
    }
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async updateProduct(
    id: number,
    updates: UpdateProductRequest,
  ): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getClients(search?: string): Promise<Client[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db
        .select()
        .from(clients)
        .where(
          or(
            ilike(clients.name, searchPattern),
            ilike(clients.phone || "", searchPattern),
            ilike(clients.address || "", searchPattern),
            ilike(clients.notes || "", searchPattern),
          ),
        );
    }
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async findClientByNameAndPhone(
    name: string,
    phone: string,
    excludeId?: number,
  ): Promise<Client | undefined> {
    const results = await db
      .select()
      .from(clients)
      .where(and(ilike(clients.name, name), ilike(clients.phone || "", phone)));
    if (excludeId) {
      return results.find((c) => c.id !== excludeId);
    }
    return results[0];
  }

  async findClientByNameAndAddress(
    name: string,
    address: string,
    excludeId?: number,
  ): Promise<Client | undefined> {
    const results = await db
      .select()
      .from(clients)
      .where(
        and(ilike(clients.name, name), ilike(clients.address || "", address)),
      );
    if (excludeId) {
      return results.find((c) => c.id !== excludeId);
    }
    return results[0];
  }

  async findClientByPhone(
    phone: string,
    excludeId?: number,
  ): Promise<Client | undefined> {
    if (excludeId) {
      const results = await db
        .select()
        .from(clients)
        .where(ilike(clients.phone || "", phone));
      return results.find((c) => c.id !== excludeId);
    }
    const [client] = await db
      .select()
      .from(clients)
      .where(ilike(clients.phone || "", phone));
    return client;
  }

  async findClientByName(
    name: string,
    excludeId?: number,
  ): Promise<Client | undefined> {
    if (excludeId) {
      const results = await db
        .select()
        .from(clients)
        .where(ilike(clients.name, name));
      return results.find((c) => c.id !== excludeId);
    }
    const [client] = await db
      .select()
      .from(clients)
      .where(ilike(clients.name, name));
    return client;
  }

  async findClientByAddress(
    address: string,
    excludeId?: number,
  ): Promise<Client | undefined> {
    if (excludeId) {
      const results = await db
        .select()
        .from(clients)
        .where(ilike(clients.address || "", address));
      return results.find((c) => c.id !== excludeId);
    }
    const [client] = await db
      .select()
      .from(clients)
      .where(ilike(clients.address || "", address));
    return client;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const clientData = {
      ...insertClient,
      amount: insertClient.amount?.toString(),
      deposit: insertClient.deposit?.toString(),
      balance: insertClient.balance?.toString(),
    };
    const [client] = await db.insert(clients).values(clientData).returning();

    // Auto-generate account number if not provided
    if (!client.billNumber) {
      const accountNumber = `ACC-${client.id.toString().padStart(4, "0")}`;
      const [updated] = await db
        .update(clients)
        .set({ billNumber: accountNumber })
        .where(eq(clients.id, client.id))
        .returning();
      return updated;
    }
    return client;
  }

  async updateClient(
    id: number,
    updates: UpdateClientRequest,
  ): Promise<Client> {
    const updateData: any = { ...updates };
    if (updates.amount !== undefined)
      updateData.amount = updates.amount.toString();
    if (updates.deposit !== undefined)
      updateData.deposit = updates.deposit.toString();
    if (updates.balance !== undefined)
      updateData.balance = updates.balance.toString();

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getBills(): Promise<Bill[]> {
    // Join with clients to get updated customer details
    const result = await db
      .select({
        bill: bills,
        client: clients,
      })
      .from(bills)
      .leftJoin(clients, eq(bills.clientId, clients.id));
    
    // Map results to use current client details when available
    return result.map(({ bill, client }) => ({
      ...bill,
      customerName: client?.name || bill.customerName,
      customerPhone: client?.phone || bill.customerPhone,
      
    }));
  }

  async getBill(id: number): Promise<Bill | undefined> {
    const result = await db
      .select({
        bill: bills,
        client: clients,
      })
      .from(bills)
      .leftJoin(clients, eq(bills.clientId, clients.id))
      .where(eq(bills.id, id));
    
    if (result.length === 0) return undefined;
    
    const { bill, client } = result[0];
    return {
      ...bill,
      customerName: client?.name || bill.customerName,
      customerPhone: client?.phone || bill.customerPhone,
      
    };
  }

  async getClientBills(clientId: number): Promise<Bill[]> {
    const result = await db
      .select({
        bill: bills,
        client: clients,
      })
      .from(bills)
      .leftJoin(clients, eq(bills.clientId, clients.id))
      .where(eq(bills.clientId, clientId))
      .orderBy(desc(bills.billDate));
    
    return result.map(({ bill, client }) => ({
      ...bill,
      customerName: client?.name || bill.customerName,
      customerPhone: client?.phone || bill.customerPhone,
      
    }));
  }

  async getUnpaidBills(clientId: number): Promise<Bill[]> {
    const result = await db
      .select({
        bill: bills,
        client: clients,
      })
      .from(bills)
      .leftJoin(clients, eq(bills.clientId, clients.id))
      .where(and(eq(bills.clientId, clientId), eq(bills.isPaid, false)))
      .orderBy(desc(bills.billDate));
    
    return result.map(({ bill, client }) => ({
      ...bill,
      customerName: client?.name || bill.customerName,
      customerPhone: client?.phone || bill.customerPhone,
      
    }));
  }

  async createBill(insertBill: InsertBill): Promise<Bill> {
    const billData = {
      ...insertBill,
      amount: insertBill.amount.toString(),
      paidAmount: insertBill.paidAmount?.toString() || "0",
      billDate: new Date(insertBill.billDate),
      isPaid: false,
    };
    const [bill] = await db.insert(bills).values(billData).returning();
    return bill;
  }

  async updateBill(
    id: number,
    updates: Partial<InsertBill> & { isPaid?: boolean },
  ): Promise<Bill> {
    const updateData: any = { ...updates };
    if (updates.amount !== undefined)
      updateData.amount = updates.amount.toString();
    if (updates.paidAmount !== undefined)
      updateData.paidAmount = updates.paidAmount.toString();
    if (updates.billDate) updateData.billDate = new Date(updates.billDate);

    const [updated] = await db
      .update(bills)
      .set(updateData)
      .where(eq(bills.id, id))
      .returning();
    return updated;
  }

  async deleteBill(id: number): Promise<void> {
    await db.delete(billPayments).where(eq(billPayments.billId, id));
    await db.delete(bills).where(eq(bills.id, id));
  }

  async getBillPayments(billId: number): Promise<BillPayment[]> {
    return await db
      .select()
      .from(billPayments)
      .where(eq(billPayments.billId, billId))
      .orderBy(desc(billPayments.paymentDate));
  }

  async getAllBillPayments(): Promise<BillPayment[]> {
    return await db
      .select()
      .from(billPayments)
      .orderBy(desc(billPayments.paymentDate));
  }

  async getClientBillPayments(clientId: number): Promise<BillPayment[]> {
    return await db
      .select()
      .from(billPayments)
      .where(eq(billPayments.clientId, clientId))
      .orderBy(desc(billPayments.paymentDate));
  }

  async createBillPayment(payment: InsertBillPayment): Promise<BillPayment> {
    const paymentData = {
      billId: payment.billId,
      clientId: payment.clientId,
      amount: payment.amount.toString(),
      paymentDate: new Date(payment.paymentDate),
      paymentMethod: payment.paymentMethod || "cash",
      notes: payment.notes,
    };
    const [created] = await db
      .insert(billPayments)
      .values(paymentData)
      .returning();
    return created;
  }

  async payBill(
    billId: number,
    amount: string,
    paymentMethod?: string,
    notes?: string,
    processedBy?: string,
  ): Promise<{ bill: Bill; payment: BillPayment }> {
    const bill = await this.getBill(billId);
    if (!bill) throw new Error("Bill not found");

    const paymentAmount = parseFloat(amount);
    const currentPaid = parseFloat(bill.paidAmount || "0");
    const billAmount = parseFloat(bill.amount);
    const newPaidAmount = currentPaid + paymentAmount;
    const isPaid = newPaidAmount >= billAmount;

    // Only create payment record if there's a clientId
    let payment: BillPayment | null = null;
    if (bill.clientId) {
      payment = await this.createBillPayment({
        billId,
        clientId: bill.clientId,
        amount,
        paymentDate: new Date(),
        paymentMethod: paymentMethod || "cash",
        notes,
      });
    }

    const updatedBill = await this.updateBill(billId, {
      paidAmount: newPaidAmount.toFixed(2),
      isPaid,
      ...(isPaid && { paymentMethod: paymentMethod || "cash" }),
    });

    // Update order paidAmounts for this bill's orders
    if (bill.clientId) {
      const clientOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.clientId, bill.clientId));
      const billOrders = clientOrders.filter((order) => order.billId === billId);

      if (billOrders.length > 0) {
        if (isPaid) {
          // Bill fully paid - mark all orders as fully paid
          await db
            .update(orders)
            .set({ paidAmount: sql`total_amount` })
            .where(inArray(orders.id, billOrders.map(o => o.id)));

          console.log(
            `[PAYMENT] Marked ${billOrders.length} order(s) as fully paid for bill ${billId}`,
          );
        } else {
          // Partial payment - distribute payment across unpaid orders proportionally
          let remainingPayment = paymentAmount;
          
          for (const order of billOrders) {
            if (remainingPayment <= 0) break;
            
            const orderTotal = parseFloat(order.totalAmount || order.finalAmount || "0");
            const orderPaid = parseFloat(order.paidAmount || "0");
            const orderRemaining = orderTotal - orderPaid;
            
            if (orderRemaining > 0) {
              const paymentForThisOrder = Math.min(remainingPayment, orderRemaining);
              const newOrderPaid = orderPaid + paymentForThisOrder;
              
              await db
                .update(orders)
                .set({ paidAmount: newOrderPaid.toFixed(2) })
                .where(eq(orders.id, order.id));
              
              remainingPayment -= paymentForThisOrder;
              console.log(
                `[PAYMENT] Applied ${paymentForThisOrder.toFixed(2)} to order #${order.orderNumber}, new paidAmount: ${newOrderPaid.toFixed(2)}`,
              );
            }
          }
        }
      }
    }

    // Only update deposit when payment method is "deposit" (using existing credit balance)
    // Cash/Card/Bank payments do NOT affect the deposit/credit balance at all
    if (bill.clientId && paymentMethod === "deposit") {
      const client = await this.getClient(bill.clientId);
      if (client && paymentAmount > 0) {
        const currentDeposit = parseFloat(client.deposit || "0");
        const currentAmount = parseFloat(client.amount || "0");
        
        // Deduct from existing deposit - customer is using their pre-paid balance
        const newDeposit = Math.max(0, currentDeposit - paymentAmount);
        const newBalance = currentAmount - newDeposit;
        
        await this.updateClient(bill.clientId, {
          deposit: newDeposit.toFixed(2),
          balance: newBalance.toFixed(2),
        });

        // Record the deposit usage transaction for history
        await this.createTransaction({
          clientId: bill.clientId,
          type: "deposit_used",
          amount: paymentAmount.toFixed(2),
          description: `Deposit used for Bill #${bill.id}: ${bill.description || "N/A"}`,
          date: new Date(),
          runningBalance: newBalance.toFixed(2),
          paymentMethod: "deposit",
          processedBy: processedBy,
        });
      }
    }
    // For cash/card/bank payments - record transaction for history but don't affect deposit
    if (bill.clientId && paymentMethod !== "deposit") {
      await this.createTransaction({
        clientId: bill.clientId,
        billId: billId,
        type: "payment",
        amount: paymentAmount.toFixed(2),
        description: `Payment for Bill #${bill.id}: ${bill.description || "N/A"}`,
        date: new Date(),
        runningBalance: "0", // Not used for payment types
        paymentMethod: paymentMethod || "cash",
        processedBy: processedBy,
      });
    }

    return { bill: updatedBill, payment: payment! };
  }

  async getClientTransactions(clientId: number): Promise<ClientTransaction[]> {
    return await db
      .select()
      .from(clientTransactions)
      .where(eq(clientTransactions.clientId, clientId))
      .orderBy(desc(clientTransactions.date));
  }

  async createTransaction(
    transaction: InsertTransaction & { billId?: number; processedBy?: string },
  ): Promise<ClientTransaction> {
    const txData = {
      clientId: transaction.clientId,
      billId: transaction.billId || null,
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: new Date(transaction.date),
      runningBalance: transaction.runningBalance.toString(),
      paymentMethod: transaction.paymentMethod || "cash",
      discount: transaction.discount?.toString() || "0",
      processedBy: transaction.processedBy || null,
    };
    const [created] = await db
      .insert(clientTransactions)
      .values(txData)
      .returning();
    return created;
  }

  async addClientBill(
    clientId: number,
    amount: string,
    description?: string,
  ): Promise<ClientTransaction> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error("Client not found");

    const billAmount = parseFloat(amount);
    const currentAmount = parseFloat(client.amount || "0");
    const currentDeposit = parseFloat(client.deposit || "0");
    const newAmount = currentAmount + billAmount;
    const newBalance = newAmount - currentDeposit;

    await this.updateClient(clientId, {
      amount: newAmount.toFixed(2),
      balance: newBalance.toFixed(2),
    });

    // Also create a bill record so it shows in the Bills tab
    const referenceNumber = `BL-${Date.now().toString(36).toUpperCase()}`;
    const createdBill = await this.createBill({
      clientId,
      amount: billAmount.toFixed(2),
      referenceNumber,
      customerName: client.name,
      customerPhone: client.phone || "",
      isPaid: false,
      billDate: new Date(),
      description: description || "Bill from client account",
    });

    return await this.createTransaction({
      clientId,
      billId: createdBill.id,
      type: "bill",
      amount: billAmount.toFixed(2),
      description: description || `Bill #${createdBill.id}`,
      date: new Date(),
      runningBalance: newBalance.toFixed(2),
    });
  }

  async addClientDeposit(
    clientId: number,
    amount: string,
    description?: string,
  ): Promise<ClientTransaction> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error("Client not found");

    const depositAmount = parseFloat(amount);
    const currentAmount = parseFloat(client.amount || "0");
    const currentDeposit = parseFloat(client.deposit || "0");
    const newDeposit = currentDeposit + depositAmount;
    const newBalance = currentAmount - newDeposit;

    await this.updateClient(clientId, {
      deposit: newDeposit.toFixed(2),
      balance: newBalance.toFixed(2),
    });

    return await this.createTransaction({
      clientId,
      type: "deposit",
      amount: depositAmount.toFixed(2),
      description: description || "Deposit received",
      date: new Date(),
      runningBalance: newBalance.toFixed(2),
    });
  }

  async deleteClientTransaction(transactionId: number): Promise<void> {
    const transaction = await db
      .select()
      .from(clientTransactions)
      .where(eq(clientTransactions.id, transactionId))
      .then((rows) => rows[0]);

    if (!transaction) throw new Error("Transaction not found");

    const client = await this.getClient(transaction.clientId);
    if (!client) throw new Error("Client not found");

    const transactionAmount = parseFloat(transaction.amount || "0");
    const currentAmount = parseFloat(client.amount || "0");
    const currentDeposit = parseFloat(client.deposit || "0");

    if (transaction.type === "bill") {
      const newAmount = currentAmount - transactionAmount;
      const newBalance = newAmount - currentDeposit;
      await this.updateClient(transaction.clientId, {
        amount: newAmount.toFixed(2),
        balance: newBalance.toFixed(2),
      });
    } else if (transaction.type === "deposit") {
      const newDeposit = currentDeposit - transactionAmount;
      const newBalance = currentAmount - newDeposit;
      await this.updateClient(transaction.clientId, {
        deposit: newDeposit.toFixed(2),
        balance: newBalance.toFixed(2),
      });
    }

    await db
      .delete(clientTransactions)
      .where(eq(clientTransactions.id, transactionId));
  }

  async updateClientTransaction(
    transactionId: number,
    data: { amount: string; description: string },
  ): Promise<ClientTransaction> {
    const transaction = await db
      .select()
      .from(clientTransactions)
      .where(eq(clientTransactions.id, transactionId))
      .then((rows) => rows[0]);

    if (!transaction) throw new Error("Transaction not found");

    const client = await this.getClient(transaction.clientId);
    if (!client) throw new Error("Client not found");

    const oldAmount = parseFloat(transaction.amount || "0");
    const newAmount = parseFloat(data.amount);
    const amountDiff = newAmount - oldAmount;
    const currentAmount = parseFloat(client.amount || "0");
    const currentDeposit = parseFloat(client.deposit || "0");

    // Update client balance based on transaction type
    if (transaction.type === "bill") {
      const updatedAmount = currentAmount + amountDiff;
      const newBalance = updatedAmount - currentDeposit;
      await this.updateClient(transaction.clientId, {
        amount: updatedAmount.toFixed(2),
        balance: newBalance.toFixed(2),
      });
    } else if (transaction.type === "deposit") {
      const updatedDeposit = currentDeposit + amountDiff;
      const newBalance = currentAmount - updatedDeposit;
      await this.updateClient(transaction.clientId, {
        deposit: updatedDeposit.toFixed(2),
        balance: newBalance.toFixed(2),
      });
    }

    // Update the transaction
    const [updated] = await db
      .update(clientTransactions)
      .set({
        amount: newAmount.toFixed(2),
        description: data.description,
      })
      .where(eq(clientTransactions.id, transactionId))
      .returning();

    return updated;
  }

  async getOrders(search?: string): Promise<Order[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db
        .select()
        .from(orders)
        .where(
          or(
            ilike(orders.orderNumber, searchPattern),
            ilike(orders.items || "", searchPattern),
            ilike(orders.notes || "", searchPattern),
          ),
        )
        .orderBy(desc(orders.entryDate));
    }
    return await db.select().from(orders).orderBy(desc(orders.entryDate));
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderByPublicToken(token: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.publicViewToken, token));
    return order;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber));
    return order;
  }

  async getDeliveredOrderByNumber(
    orderNumber: string,
  ): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.orderNumber, orderNumber), eq(orders.delivered, true)),
      );
    return order;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderData = {
      clientId: insertOrder.clientId,
      orderNumber: insertOrder.orderNumber,
      items: insertOrder.items,
      totalAmount: insertOrder.totalAmount.toString(),
      finalAmount: insertOrder.finalAmount?.toString() || "0",
      paidAmount: insertOrder.paidAmount?.toString() || "0",
      status: insertOrder.status || "entry",
      deliveryType: insertOrder.deliveryType || "takeaway",
      expectedDeliveryAt: insertOrder.expectedDeliveryAt
        ? new Date(insertOrder.expectedDeliveryAt)
        : null,
      entryDate: new Date(insertOrder.entryDate),
      entryBy: insertOrder.entryBy,
      washingDone: insertOrder.washingDone || false,
      washingDate: insertOrder.washingDate
        ? new Date(insertOrder.washingDate)
        : null,
      washingBy: insertOrder.washingBy,
      packingDone: insertOrder.packingDone || false,
      packingDate: insertOrder.packingDate
        ? new Date(insertOrder.packingDate)
        : null,
      packingBy: insertOrder.packingBy,
      delivered: insertOrder.delivered || false,
      deliveryDate: insertOrder.deliveryDate
        ? new Date(insertOrder.deliveryDate)
        : null,
      deliveryBy: insertOrder.deliveryBy,
      notes: insertOrder.notes,
      urgent: insertOrder.urgent || false,
    };
    const [order] = await db.insert(orders).values(orderData).returning();
    return order;
  }

  async updateOrder(id: number, updates: UpdateOrderRequest): Promise<Order> {
    const updateData: any = { ...updates };
    if (updates.entryDate) updateData.entryDate = new Date(updates.entryDate);
    if (updates.tagDate) updateData.tagDate = new Date(updates.tagDate);
    if (updates.washingDate)
      updateData.washingDate = new Date(updates.washingDate);
    if (updates.packingDate)
      updateData.packingDate = new Date(updates.packingDate);
    if (updates.deliveryDate)
      updateData.deliveryDate = new Date(updates.deliveryDate);
    if (updates.expectedDeliveryAt)
      updateData.expectedDeliveryAt = new Date(updates.expectedDeliveryAt);
    if (updates.verifiedAt)
      updateData.verifiedAt = new Date(updates.verifiedAt);

    // Check if order is being marked as delivered
    if (updates.delivered === true) {
      const existingOrder = await this.getOrder(id);
      if (existingOrder && !existingOrder.delivered) {
        // Order is being marked as delivered for the first time, deduct stock
        await this.deductStockForOrder(id);
      }
    }

    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  async deleteAllOrders(): Promise<void> {
    await db.delete(orders);
    // Reset all product stock to zero
    await db.update(products).set({ stockQuantity: 0 });
  }

  async deleteAllTransactions(): Promise<void> {
    await db.delete(clientTransactions);
  }

  async deleteAllBills(): Promise<void> {
    await db.delete(clientTransactions);
    await db.delete(bills);
  }

  async deleteAllClients(): Promise<void> {
    await db.delete(clientTransactions);
    await db.delete(clients);
  }

  async getPackingWorkers(): Promise<PackingWorker[]> {
    return await db.select().from(packingWorkers);
  }

  async getPackingWorker(id: number): Promise<PackingWorker | undefined> {
    const [worker] = await db
      .select()
      .from(packingWorkers)
      .where(eq(packingWorkers.id, id));
    return worker;
  }

  async createPackingWorker(
    worker: InsertPackingWorker,
  ): Promise<PackingWorker> {
    const hashedPin = await bcrypt.hash(worker.pin, 10);
    const [created] = await db
      .insert(packingWorkers)
      .values({ ...worker, pin: hashedPin })
      .returning();
    return created;
  }

  async updatePackingWorker(
    id: number,
    updates: Partial<InsertPackingWorker>,
  ): Promise<PackingWorker> {
    const updateData: any = { ...updates };
    if (updates.pin) {
      updateData.pin = await bcrypt.hash(updates.pin, 10);
    }
    const [updated] = await db
      .update(packingWorkers)
      .set(updateData)
      .where(eq(packingWorkers.id, id))
      .returning();
    return updated;
  }

  async deletePackingWorker(id: number): Promise<void> {
    await db.delete(packingWorkers).where(eq(packingWorkers.id, id));
  }

  async verifyPackingWorkerPin(pin: string): Promise<PackingWorker | null> {
    const activeWorkers = await db
      .select()
      .from(packingWorkers)
      .where(eq(packingWorkers.active, true));
    for (const worker of activeWorkers) {
      const isMatch = await bcrypt.compare(pin, worker.pin);
      if (isMatch) {
        return worker;
      }
    }
    return null;
  }

  async verifyDeliveryWorkerPin(pin: string): Promise<PackingWorker | null> {
    const activeWorkers = await db
      .select()
      .from(packingWorkers)
      .where(eq(packingWorkers.active, true));
    for (const worker of activeWorkers) {
      const isMatch = await bcrypt.compare(pin, worker.pin);
      if (isMatch) {
        return worker;
      }
    }
    return null;
  }

  async verifyUserPin(pin: string): Promise<User | null> {
    const activeUsers = await db
      .select()
      .from(users)
      .where(eq(users.active, true));
    for (const user of activeUsers) {
      if (user.pin === pin) {
        return user;
      }
    }
    return null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0] || null;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getClientOrders(clientId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.clientId, clientId))
      .orderBy(desc(orders.entryDate));
  }

  async getIncidents(search?: string): Promise<Incident[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db
        .select()
        .from(incidents)
        .where(
          or(
            ilike(incidents.customerName, searchPattern),
            ilike(incidents.orderNumber || "", searchPattern),
            ilike(incidents.itemName || "", searchPattern),
            ilike(incidents.reason, searchPattern),
          ),
        )
        .orderBy(desc(incidents.incidentDate));
    }
    return await db
      .select()
      .from(incidents)
      .orderBy(desc(incidents.incidentDate));
  }

  async getIncident(id: number): Promise<Incident | undefined> {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id));
    return incident;
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const incidentData = {
      customerName: insertIncident.customerName,
      customerPhone: insertIncident.customerPhone,
      orderId: insertIncident.orderId,
      orderNumber: insertIncident.orderNumber,
      itemName: insertIncident.itemName,
      reason: insertIncident.reason,
      notes: insertIncident.notes,
      refundAmount: insertIncident.refundAmount?.toString() || "0",
      itemValue: insertIncident.itemValue?.toString() || "0",
      responsibleStaffId: insertIncident.responsibleStaffId,
      responsibleStaffName: insertIncident.responsibleStaffName,
      incidentType: insertIncident.incidentType || "refund",
      status: insertIncident.status || "open",
      incidentDate: new Date(insertIncident.incidentDate),
      resolvedDate: insertIncident.resolvedDate
        ? new Date(insertIncident.resolvedDate)
        : null,
      resolution: insertIncident.resolution,
    };
    const [incident] = await db
      .insert(incidents)
      .values(incidentData)
      .returning();
    return incident;
  }

  async updateIncident(
    id: number,
    updates: Partial<InsertIncident>,
  ): Promise<Incident> {
    const updateData: any = { ...updates };
    if (updates.refundAmount !== undefined)
      updateData.refundAmount = updates.refundAmount.toString();
    if (updates.itemValue !== undefined)
      updateData.itemValue = updates.itemValue.toString();
    if (updates.incidentDate)
      updateData.incidentDate = new Date(updates.incidentDate);
    if (updates.resolvedDate)
      updateData.resolvedDate = new Date(updates.resolvedDate);

    const [updated] = await db
      .update(incidents)
      .set(updateData)
      .where(eq(incidents.id, id))
      .returning();
    return updated;
  }

  async deleteIncident(id: number): Promise<void> {
    await db.delete(incidents).where(eq(incidents.id, id));
  }

  private parseOrderItems(
    itemsString: string,
  ): { name: string; quantity: number }[] {
    const parsedItems: { name: string; quantity: number }[] = [];
    // Split on comma with optional space to handle both ", " and "," formats
    const items = itemsString.split(/,\s*/);

    for (const item of items) {
      const trimmedItem = item.trim();
      if (!trimmedItem) continue;

      // Pattern 1: "Product Name x3" or "Product Name x3 (Hanging)"
      let match = trimmedItem.match(/^(.+?)\s+x(\d+)(?:\s+\(.*\))?$/);
      if (match) {
        parsedItems.push({
          name: match[1].trim(),
          quantity: parseInt(match[2]),
        });
        continue;
      }

      // Pattern 2: "3x Product Name @ 10 AED" (custom items)
      match = trimmedItem.match(/^(\d+)x\s+(.+?)(?:\s+@\s+[\d.]+\s+AED)?$/);
      if (match) {
        parsedItems.push({
          name: match[2].trim(),
          quantity: parseInt(match[1]),
        });
        continue;
      }

      // Fallback: treat as 1 item with whole string as name
      parsedItems.push({ name: trimmedItem, quantity: 1 });
    }

    return parsedItems;
  }

  async getAllocatedStock(): Promise<Record<string, number>> {
    const allOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.delivered, false));
    const allocatedStock: Record<string, number> = {};

    for (const order of allOrders) {
      if (!order.items) continue;
      const parsedItems = this.parseOrderItems(order.items);
      for (const item of parsedItems) {
        allocatedStock[item.name] =
          (allocatedStock[item.name] || 0) + item.quantity;
      }
    }

    return allocatedStock;
  }

  async addStockForOrder(orderId: number): Promise<void> {
    console.log(`[STOCK DEBUG] Adding stock for order ${orderId}`);
    const order = await this.getOrder(orderId);
    console.log(
      `[STOCK DEBUG] Order:`,
      order
        ? {
            id: order.id,
            stockDeducted: order.stockDeducted,
            items: order.items,
          }
        : "null",
    );

    if (!order || order.stockDeducted || !order.items) {
      console.log(
        `[STOCK DEBUG] Early return - !order: ${!order}, order.stockDeducted: ${order?.stockDeducted}, !order.items: ${!order?.items}`,
      );
      return;
    }

    const parsedItems = this.parseOrderItems(order.items);
    console.log(`[STOCK DEBUG] Parsed items:`, parsedItems);
    const allProducts = await db.select().from(products);

    for (const item of parsedItems) {
      // Try exact match first, then case-insensitive match
      let product = allProducts.find((p) => p.name === item.name);
      console.log(
        `[STOCK DEBUG] Step 1 - Exact match for "${item.name}":`,
        product ? `Found: ${product.name}` : "Not found",
      );

      if (!product) {
        product = allProducts.find(
          (p) => p.name.toLowerCase() === item.name.toLowerCase(),
        );
        console.log(
          `[STOCK DEBUG] Step 2 - Case-insensitive match for "${item.name}":`,
          product ? `Found: ${product.name}` : "Not found",
        );
      }
      // Try partial match for items with size/type modifiers like "(Small)" or "(Hanging)"
      if (!product) {
        const baseName = item.name.replace(/\s*\([^)]*\)$/, "").trim(); // Remove only the LAST parenthetical expression
        console.log(
          `[STOCK DEBUG] Step 3 - Removing last parenthesis: "${item.name}" -> "${baseName}"`,
        );
        product = allProducts.find(
          (p) => p.name.toLowerCase() === baseName.toLowerCase(),
        );
        console.log(
          `[STOCK DEBUG] Step 3 - Base name match for "${baseName}":`,
          product ? `Found: ${product.name}` : "Not found",
        );
      }
      // Try removing ALL parenthetical expressions as final fallback
      if (!product) {
        const baseName = item.name.replace(/\s*\(.*?\)/g, "").trim(); // Remove ALL parenthetical expressions
        console.log(
          `[STOCK DEBUG] Step 4 - Removing all parentheses: "${item.name}" -> "${baseName}"`,
        );
        product = allProducts.find(
          (p) => p.name.toLowerCase() === baseName.toLowerCase(),
        );
        console.log(
          `[STOCK DEBUG] Step 4 - All removed match for "${baseName}":`,
          product ? `Found: ${product.name}` : "Not found",
        );
      }

      console.log(
        `[STOCK DEBUG] Item: "${item.name}" qty: ${item.quantity}, Product found:`,
        product
          ? {
              id: product.id,
              name: product.name,
              currentStock: product.stockQuantity,
            }
          : "null",
      );

      if (product) {
        const currentStock = product.stockQuantity || 0;
        const newStock = currentStock + item.quantity;
        console.log(
          `[STOCK DEBUG] Updating stock from ${currentStock} to ${newStock}`,
        );
        await db
          .update(products)
          .set({ stockQuantity: newStock })
          .where(eq(products.id, product.id));
      }
    }

    await db
      .update(orders)
      .set({ stockDeducted: true })
      .where(eq(orders.id, orderId));
  }

  async deductStockForOrder(orderId: number): Promise<void> {
    const order = await this.getOrder(orderId);
    if (!order || !order.stockDeducted || !order.items) return;

    const parsedItems = this.parseOrderItems(order.items);
    const allProducts = await db.select().from(products);

    for (const item of parsedItems) {
      let product = allProducts.find((p) => p.name === item.name);
      if (!product) {
        product = allProducts.find(
          (p) => p.name.toLowerCase() === item.name.toLowerCase(),
        );
      }
      if (!product) {
        const baseName = item.name.replace(/\s*\([^)]*\)$/, "").trim(); // Remove only the LAST parenthetical expression
        product = allProducts.find(
          (p) => p.name.toLowerCase() === baseName.toLowerCase(),
        );
      }
      // Try removing ALL parenthetical expressions as final fallback
      if (!product) {
        const baseName = item.name.replace(/\s*\(.*?\)/g, "").trim(); // Remove ALL parenthetical expressions
        product = allProducts.find(
          (p) => p.name.toLowerCase() === baseName.toLowerCase(),
        );
      }

      if (product) {
        const currentStock = product.stockQuantity || 0;
        const newStock = Math.max(0, currentStock - item.quantity);
        await db
          .update(products)
          .set({ stockQuantity: newStock })
          .where(eq(products.id, product.id));
      }
    }
  }

  async getMissingItems(search?: string): Promise<MissingItem[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db
        .select()
        .from(missingItems)
        .where(
          or(
            ilike(missingItems.itemName, searchPattern),
            ilike(missingItems.customerName || "", searchPattern),
            ilike(missingItems.orderNumber || "", searchPattern),
            ilike(missingItems.responsibleWorkerName || "", searchPattern),
          ),
        )
        .orderBy(desc(missingItems.reportedAt));
    }
    return await db
      .select()
      .from(missingItems)
      .orderBy(desc(missingItems.reportedAt));
  }

  async getMissingItem(id: number): Promise<MissingItem | undefined> {
    const [item] = await db
      .select()
      .from(missingItems)
      .where(eq(missingItems.id, id));
    return item;
  }

  async createMissingItem(item: InsertMissingItem): Promise<MissingItem> {
    const dbItem = {
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      customerName: item.customerName,
      itemName: item.itemName,
      quantity: item.quantity,
      stage: item.stage,
      responsibleWorkerId: item.responsibleWorkerId,
      responsibleWorkerName: item.responsibleWorkerName,
      reportedByWorkerId: item.reportedByWorkerId,
      reportedByWorkerName: item.reportedByWorkerName,
      notes: item.notes,
      status: item.status,
      resolution: item.resolution,

      itemValue: item.itemValue != null ? String(item.itemValue) : undefined,

      reportedAt: new Date(item.reportedAt),

      resolvedAt:
        item.resolvedAt === null
          ? null
          : item.resolvedAt
            ? new Date(item.resolvedAt)
            : undefined,
    };

    const [created] = await db.insert(missingItems).values(dbItem).returning();

    return created;
  }

  async updateMissingItem(
    id: number,
    updates: Partial<InsertMissingItem>,
  ): Promise<MissingItem> {
    const dbUpdates = {
      itemName: updates.itemName,
      stage: updates.stage,
      status: updates.status,
      notes: updates.notes,
      customerName: updates.customerName,
      quantity: updates.quantity,
      resolution: updates.resolution,

      itemValue:
        updates.itemValue != null ? String(updates.itemValue) : undefined,

      reportedAt:
        updates.reportedAt != null ? new Date(updates.reportedAt) : undefined,

      resolvedAt:
        updates.resolvedAt === null
          ? null
          : updates.resolvedAt
            ? new Date(updates.resolvedAt)
            : undefined,
    };

    const [updated] = await db
      .update(missingItems)
      .set(dbUpdates)
      .where(eq(missingItems.id, id))
      .returning();

    return updated;
  }

  async deleteMissingItem(id: number): Promise<void> {
    await db.delete(missingItems).where(eq(missingItems.id, id));
  }
}

export const storage = new DatabaseStorage();
