import { db } from "./db";
import {
  products,
  clients,
  bills,
  clientTransactions,
  type Product,
  type Client,
  type Bill,
  type ClientTransaction,
  type InsertProduct,
  type InsertClient,
  type InsertBill,
  type InsertTransaction,
  type UpdateProductRequest,
  type UpdateClientRequest
} from "@shared/schema";
import { eq, ilike, or, desc } from "drizzle-orm";

export interface IStorage {
  getProducts(search?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getClients(search?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: UpdateClientRequest): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  getBills(): Promise<Bill[]>;
  getBill(id: number): Promise<Bill | undefined>;
  createBill(bill: InsertBill): Promise<Bill>;
  deleteBill(id: number): Promise<void>;
  getClientTransactions(clientId: number): Promise<ClientTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<ClientTransaction>;
  addClientBill(clientId: number, amount: string, description?: string): Promise<ClientTransaction>;
  addClientDeposit(clientId: number, amount: string, description?: string): Promise<ClientTransaction>;
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

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: number, updates: UpdateClientRequest): Promise<Client> {
    const [updated] = await db.update(clients)
      .set(updates)
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

  async createBill(insertBill: InsertBill): Promise<Bill> {
    const [bill] = await db.insert(bills).values(insertBill).returning();
    return bill;
  }

  async deleteBill(id: number): Promise<void> {
    await db.delete(bills).where(eq(bills.id, id));
  }

  async getClientTransactions(clientId: number): Promise<ClientTransaction[]> {
    return await db.select().from(clientTransactions)
      .where(eq(clientTransactions.clientId, clientId))
      .orderBy(desc(clientTransactions.date));
  }

  async createTransaction(transaction: InsertTransaction): Promise<ClientTransaction> {
    const [created] = await db.insert(clientTransactions).values({
      ...transaction,
      date: new Date(transaction.date),
    }).returning();
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
}

export const storage = new DatabaseStorage();
