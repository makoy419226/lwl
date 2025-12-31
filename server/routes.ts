import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on startup
  await seedDatabase();

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    
    const [user] = await db.select().from(users).where(
      and(
        eq(users.username, username),
        eq(users.password, password),
        eq(users.active, true)
      )
    );
    
    if (user) {
      res.json({ 
        success: true, 
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        }
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid username or password" });
    }
  });

  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    const userList = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      name: users.name,
      active: users.active
    }).from(users);
    res.json(userList);
  });

  // Create user
  app.post("/api/users", async (req, res) => {
    const { username, password, role, name } = req.body;
    try {
      const [newUser] = await db.insert(users).values({
        username,
        password,
        role: role || "cashier",
        name,
        active: true
      }).returning();
      res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    const { password, role, name, active } = req.body;
    const updates: any = {};
    if (password) updates.password = password;
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    
    const [updated] = await db.update(users).set(updates).where(eq(users.id, Number(req.params.id))).returning();
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ id: updated.id, username: updated.username, role: updated.role, name: updated.name, active: updated.active });
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    await db.delete(users).where(eq(users.id, Number(req.params.id)));
    res.status(204).send();
  });

  // Client routes
  app.get(api.clients.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const clientList = await storage.getClients(search);
    res.json(clientList);
  });

  app.get(api.clients.get.path, async (req, res) => {
    const client = await storage.getClient(Number(req.params.id));
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  });

  app.post("/api/clients/check-duplicate", async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.json({ exists: false, client: null });
    }
    const existingClient = await storage.findClientByNameAndPhone(name, phone);
    res.json({ exists: !!existingClient, client: existingClient || null });
  });

  app.post(api.clients.create.path, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      const client = await storage.createClient(input);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.clients.update.path, async (req, res) => {
    try {
      const input = api.clients.update.input.parse(req.body);
      const client = await storage.updateClient(Number(req.params.id), input);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.clients.delete.path, async (req, res) => {
    await storage.deleteClient(Number(req.params.id));
    res.status(204).send();
  });

  // Product routes
  app.get(api.products.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const products = await storage.getProducts(search);
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  });

  app.post(api.products.create.path, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.products.update.path, async (req, res) => {
    try {
      const input = api.products.update.input.parse(req.body);
      const product = await storage.updateProduct(Number(req.params.id), input);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.products.delete.path, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.status(204).send();
  });

  // Bill routes
  app.get(api.bills.list.path, async (req, res) => {
    const billList = await storage.getBills();
    res.json(billList);
  });

  app.get(api.bills.get.path, async (req, res) => {
    const bill = await storage.getBill(Number(req.params.id));
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.json(bill);
  });

  app.post(api.bills.create.path, async (req, res) => {
    try {
      const input = api.bills.create.input.parse(req.body);
      const bill = await storage.createBill(input);
      res.status(201).json(bill);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.bills.delete.path, async (req, res) => {
    await storage.deleteBill(Number(req.params.id));
    res.status(204).send();
  });

  // Transaction routes
  app.get("/api/clients/:id/transactions", async (req, res) => {
    const transactions = await storage.getClientTransactions(Number(req.params.id));
    res.json(transactions);
  });

  app.post("/api/clients/:id/bill", async (req, res) => {
    try {
      const { amount, description } = req.body;
      const transaction = await storage.addClientBill(Number(req.params.id), amount, description);
      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/clients/:id/deposit", async (req, res) => {
    try {
      const { amount, description } = req.body;
      const transaction = await storage.addClientDeposit(Number(req.params.id), amount, description);
      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Order routes
  app.get("/api/orders", async (req, res) => {
    const search = req.query.search as string | undefined;
    const orderList = await storage.getOrders(search);
    res.json(orderList);
  });

  app.get("/api/orders/due-soon", async (req, res) => {
    const windowMinutes = parseInt(req.query.window as string) || 60;
    const allOrders = await storage.getOrders();
    const now = new Date();
    const dueSoon = allOrders.filter(order => {
      if (!order.expectedDeliveryAt || order.delivered) return false;
      const timeDiff = new Date(order.expectedDeliveryAt).getTime() - now.getTime();
      const minutesLeft = timeDiff / (1000 * 60);
      return minutesLeft > 0 && minutesLeft <= windowMinutes;
    });
    res.json(dueSoon);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const order = await storage.createOrder(req.body);
      res.status(201).json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.updateOrder(Number(req.params.id), req.body);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    await storage.deleteOrder(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
