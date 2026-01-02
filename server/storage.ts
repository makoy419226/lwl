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
  type Product,
  type Client,
  type Bill,
  type BillPayment,
  type ClientTransaction,
  type Order,
  type PackingWorker,
  type InsertProduct,
  type InsertClient,
  type InsertBill,
  type InsertBillPayment,
  type InsertTransaction,
  type InsertOrder,
  type InsertPackingWorker,
  type UpdateProductRequest,
  type UpdateClientRequest,
  type UpdateOrderRequest
} from "@shared/schema";
import { eq, ilike, or, desc, and } from "drizzle-orm";

export interface IStorage {
  getProducts(search?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getClients(search?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  findClientByNameAndPhone(name: string, phone: string): Promise<Client | undefined>;
  findClientByPhone(phone: string, excludeId?: number): Promise<Client | undefined>;
  findClientByName(name: string, excludeId?: number): Promise<Client | undefined>;
  findClientByAddress(address: string, excludeId?: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: UpdateClientRequest): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  getBills(): Promise<Bill[]>;
  getBill(id: number): Promise<Bill | undefined>;
  getClientBills(clientId: number): Promise<Bill[]>;
  getUnpaidBills(clientId: number): Promise<Bill[]>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: number, updates: Partial<InsertBill> & { isPaid?: boolean }): Promise<Bill>;
  deleteBill(id: number): Promise<void>;
  getBillPayments(billId: number): Promise<BillPayment[]>;
  getClientBillPayments(clientId: number): Promise<BillPayment[]>;
  createBillPayment(payment: InsertBillPayment): Promise<BillPayment>;
  payBill(billId: number, amount: string, paymentMethod?: string, notes?: string): Promise<{ bill: Bill; payment: BillPayment }>;
  getClientTransactions(clientId: number): Promise<ClientTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<ClientTransaction>;
  addClientBill(clientId: number, amount: string, description?: string): Promise<ClientTransaction>;
  addClientDeposit(clientId: number, amount: string, description?: string): Promise<ClientTransaction>;
  getOrders(search?: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: UpdateOrderRequest): Promise<Order>;
  deleteOrder(id: number): Promise<void>;
  getPackingWorkers(): Promise<PackingWorker[]>;
  getPackingWorker(id: number): Promise<PackingWorker | undefined>;
  createPackingWorker(worker: InsertPackingWorker): Promise<PackingWorker>;
  updatePackingWorker(id: number, updates: Partial<InsertPackingWorker>): Promise<PackingWorker>;
  deletePackingWorker(id: number): Promise<void>;
  verifyPackingWorkerPin(pin: string): Promise<PackingWorker | null>;
  verifyDeliveryWorkerPin(pin: string): Promise<PackingWorker | null>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(search?: string): Promise<Product[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db.select().from(products).where(
        or(
          ilike(products.name, searchPattern),
          ilike(products.description || '', searchPattern)
        )
      );
    }
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, updates: UpdateProductRequest): Promise<Product> {
    const [updated] = await db.update(products)
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
      return await db.select().from(clients).where(
        or(
          ilike(clients.name, searchPattern),
          ilike(clients.phone || '', searchPattern),
          ilike(clients.address || '', searchPattern),
          ilike(clients.contact || '', searchPattern)
        )
      );
    }
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async findClientByNameAndPhone(name: string, phone: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(
      and(
        ilike(clients.name, name),
        ilike(clients.phone || '', phone)
      )
    );
    return client;
  }

  async findClientByPhone(phone: string, excludeId?: number): Promise<Client | undefined> {
    if (excludeId) {
      const results = await db.select().from(clients).where(
        ilike(clients.phone || '', phone)
      );
      return results.find(c => c.id !== excludeId);
    }
    const [client] = await db.select().from(clients).where(
      ilike(clients.phone || '', phone)
    );
    return client;
  }

  async findClientByName(name: string, excludeId?: number): Promise<Client | undefined> {
    if (excludeId) {
      const results = await db.select().from(clients).where(
        ilike(clients.name, name)
      );
      return results.find(c => c.id !== excludeId);
    }
    const [client] = await db.select().from(clients).where(
      ilike(clients.name, name)
    );
    return client;
  }

  async findClientByAddress(address: string, excludeId?: number): Promise<Client | undefined> {
    if (excludeId) {
      const results = await db.select().from(clients).where(
        ilike(clients.address || '', address)
      );
      return results.find(c => c.id !== excludeId);
    }
    const [client] = await db.select().from(clients).where(
      ilike(clients.address || '', address)
    );
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
    return client;
  }

  async updateClient(id: number, updates: UpdateClientRequest): Promise<Client> {
    const updateData: any = { ...updates };
    if (updates.amount !== undefined) updateData.amount = updates.amount.toString();
    if (updates.deposit !== undefined) updateData.deposit = updates.deposit.toString();
    if (updates.balance !== undefined) updateData.balance = updates.balance.toString();
    
    const [updated] = await db.update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getBills(): Promise<Bill[]> {
    return await db.select().from(bills);
  }

  async getBill(id: number): Promise<Bill | undefined> {
    const [bill] = await db.select().from(bills).where(eq(bills.id, id));
    return bill;
  }

  async getClientBills(clientId: number): Promise<Bill[]> {
    return await db.select().from(bills)
      .where(eq(bills.clientId, clientId))
      .orderBy(desc(bills.billDate));
  }

  async getUnpaidBills(clientId: number): Promise<Bill[]> {
    return await db.select().from(bills)
      .where(and(
        eq(bills.clientId, clientId),
        eq(bills.isPaid, false)
      ))
      .orderBy(desc(bills.billDate));
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

  async updateBill(id: number, updates: Partial<InsertBill> & { isPaid?: boolean }): Promise<Bill> {
    const updateData: any = { ...updates };
    if (updates.amount !== undefined) updateData.amount = updates.amount.toString();
    if (updates.paidAmount !== undefined) updateData.paidAmount = updates.paidAmount.toString();
    if (updates.billDate) updateData.billDate = new Date(updates.billDate);
    
    const [updated] = await db.update(bills)
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
    return await db.select().from(billPayments)
      .where(eq(billPayments.billId, billId))
      .orderBy(desc(billPayments.paymentDate));
  }

  async getClientBillPayments(clientId: number): Promise<BillPayment[]> {
    return await db.select().from(billPayments)
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
    const [created] = await db.insert(billPayments).values(paymentData).returning();
    return created;
  }

  async payBill(billId: number, amount: string, paymentMethod?: string, notes?: string): Promise<{ bill: Bill; payment: BillPayment }> {
    const bill = await this.getBill(billId);
    if (!bill) throw new Error("Bill not found");

    const paymentAmount = parseFloat(amount);
    const currentPaid = parseFloat(bill.paidAmount || "0");
    const billAmount = parseFloat(bill.amount);
    const newPaidAmount = currentPaid + paymentAmount;
    const isPaid = newPaidAmount >= billAmount;

    const payment = await this.createBillPayment({
      billId,
      clientId: bill.clientId,
      amount,
      paymentDate: new Date(),
      paymentMethod: paymentMethod || "cash",
      notes,
    });

    const updatedBill = await this.updateBill(billId, {
      paidAmount: newPaidAmount.toFixed(2),
      isPaid,
    });

    // Update client deposit and balance directly without creating a transaction
    // to avoid double-counting (the bill payment itself is already tracked)
    const client = await this.getClient(bill.clientId);
    if (client && paymentAmount > 0) {
      const currentDeposit = parseFloat(client.deposit || "0");
      const currentAmount = parseFloat(client.amount || "0");
      const newDeposit = currentDeposit + paymentAmount;
      const newBalance = currentAmount - newDeposit;
      
      await this.updateClient(bill.clientId, {
        deposit: newDeposit.toFixed(2),
        balance: newBalance.toFixed(2),
      });
      
      // Record the transaction for history without triggering balance changes again
      await this.createTransaction({
        clientId: bill.clientId,
        type: "deposit",
        amount: paymentAmount.toFixed(2),
        description: `Payment for Bill #${bill.id}: ${bill.description || "N/A"}`,
        date: new Date(),
        runningBalance: newBalance.toFixed(2),
        paymentMethod: paymentMethod || "cash",
      });
    }

    return { bill: updatedBill, payment };
  }

  async getClientTransactions(clientId: number): Promise<ClientTransaction[]> {
    return await db.select().from(clientTransactions)
      .where(eq(clientTransactions.clientId, clientId))
      .orderBy(desc(clientTransactions.date));
  }

  async createTransaction(transaction: InsertTransaction): Promise<ClientTransaction> {
    const txData = {
      clientId: transaction.clientId,
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: new Date(transaction.date),
      runningBalance: transaction.runningBalance.toString(),
      paymentMethod: transaction.paymentMethod || "cash",
      discount: transaction.discount?.toString() || "0",
    };
    const [created] = await db.insert(clientTransactions).values(txData).returning();
    return created;
  }

  async addClientBill(clientId: number, amount: string, description?: string): Promise<ClientTransaction> {
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

    return await this.createTransaction({
      clientId,
      type: "bill",
      amount: billAmount.toFixed(2),
      description: description || "Bill added",
      date: new Date(),
      runningBalance: newBalance.toFixed(2),
    });
  }

  async addClientDeposit(clientId: number, amount: string, description?: string): Promise<ClientTransaction> {
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

  async getOrders(search?: string): Promise<Order[]> {
    if (search) {
      const searchPattern = `%${search}%`;
      return await db.select().from(orders).where(
        or(
          ilike(orders.orderNumber, searchPattern),
          ilike(orders.items || '', searchPattern),
          ilike(orders.notes || '', searchPattern)
        )
      ).orderBy(desc(orders.entryDate));
    }
    return await db.select().from(orders).orderBy(desc(orders.entryDate));
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderData = {
      clientId: insertOrder.clientId,
      orderNumber: insertOrder.orderNumber,
      items: insertOrder.items,
      totalAmount: insertOrder.totalAmount.toString(),
      paidAmount: insertOrder.paidAmount?.toString() || "0",
      status: insertOrder.status || "entry",
      deliveryType: insertOrder.deliveryType || "takeaway",
      expectedDeliveryAt: insertOrder.expectedDeliveryAt ? new Date(insertOrder.expectedDeliveryAt) : null,
      entryDate: new Date(insertOrder.entryDate),
      entryBy: insertOrder.entryBy,
      washingDone: insertOrder.washingDone || false,
      washingDate: insertOrder.washingDate ? new Date(insertOrder.washingDate) : null,
      washingBy: insertOrder.washingBy,
      packingDone: insertOrder.packingDone || false,
      packingDate: insertOrder.packingDate ? new Date(insertOrder.packingDate) : null,
      packingBy: insertOrder.packingBy,
      delivered: insertOrder.delivered || false,
      deliveryDate: insertOrder.deliveryDate ? new Date(insertOrder.deliveryDate) : null,
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
    if (updates.washingDate) updateData.washingDate = new Date(updates.washingDate);
    if (updates.packingDate) updateData.packingDate = new Date(updates.packingDate);
    if (updates.deliveryDate) updateData.deliveryDate = new Date(updates.deliveryDate);
    
    const [updated] = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  async getPackingWorkers(): Promise<PackingWorker[]> {
    return await db.select().from(packingWorkers);
  }

  async getPackingWorker(id: number): Promise<PackingWorker | undefined> {
    const [worker] = await db.select().from(packingWorkers).where(eq(packingWorkers.id, id));
    return worker;
  }

  async createPackingWorker(worker: InsertPackingWorker): Promise<PackingWorker> {
    const hashedPin = await bcrypt.hash(worker.pin, 10);
    const [created] = await db.insert(packingWorkers).values({ ...worker, pin: hashedPin }).returning();
    return created;
  }

  async updatePackingWorker(id: number, updates: Partial<InsertPackingWorker>): Promise<PackingWorker> {
    const updateData: any = { ...updates };
    if (updates.pin) {
      updateData.pin = await bcrypt.hash(updates.pin, 10);
    }
    const [updated] = await db.update(packingWorkers)
      .set(updateData)
      .where(eq(packingWorkers.id, id))
      .returning();
    return updated;
  }

  async deletePackingWorker(id: number): Promise<void> {
    await db.delete(packingWorkers).where(eq(packingWorkers.id, id));
  }

  async verifyPackingWorkerPin(pin: string): Promise<PackingWorker | null> {
    const activeWorkers = await db.select().from(packingWorkers).where(
      eq(packingWorkers.active, true)
    );
    for (const worker of activeWorkers) {
      const isMatch = await bcrypt.compare(pin, worker.pin);
      if (isMatch) {
        return worker;
      }
    }
    return null;
  }

  async verifyDeliveryWorkerPin(pin: string): Promise<PackingWorker | null> {
    const activeWorkers = await db.select().from(packingWorkers).where(
      eq(packingWorkers.active, true)
    );
    for (const worker of activeWorkers) {
      const isMatch = await bcrypt.compare(pin, worker.pin);
      if (isMatch) {
        return worker;
      }
    }
    return null;
  }
}

export const storage = new DatabaseStorage();
