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
      
      // Check for duplicate name
      if (input.name) {
        const existingClient = await storage.findClientByName(input.name);
        if (existingClient) {
          return res.status(409).json({
            message: `A client with name "${input.name}" already exists`,
            field: 'name',
          });
        }
      }
      
      // Check for duplicate phone number
      if (input.phone) {
        const existingClient = await storage.findClientByPhone(input.phone);
        if (existingClient) {
          return res.status(409).json({
            message: `A client with phone number "${input.phone}" already exists`,
            field: 'phone',
          });
        }
      }
      
      // Check for duplicate address
      if (input.address) {
        const existingClient = await storage.findClientByAddress(input.address);
        if (existingClient) {
          return res.status(409).json({
            message: `A client with address "${input.address}" already exists`,
            field: 'address',
          });
        }
      }
      
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
      const clientId = Number(req.params.id);
      
      // Check for duplicate phone number (excluding current client)
      if (input.phone) {
        const existingClient = await storage.findClientByPhone(input.phone, clientId);
        if (existingClient) {
          return res.status(409).json({
            message: `A client with phone number "${input.phone}" already exists`,
            field: 'phone',
          });
        }
      }
      
      const client = await storage.updateClient(clientId, input);
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

  // Client bills routes
  app.get("/api/clients/:id/bills", async (req, res) => {
    const bills = await storage.getClientBills(Number(req.params.id));
    res.json(bills);
  });

  app.get("/api/clients/:id/unpaid-bills", async (req, res) => {
    const bills = await storage.getUnpaidBills(Number(req.params.id));
    res.json(bills);
  });

  app.get("/api/clients/:id/orders", async (req, res) => {
    const clientOrders = await storage.getClientOrders(Number(req.params.id));
    res.json(clientOrders);
  });

  // Bill payments routes
  app.get("/api/bills/:id/payments", async (req, res) => {
    const payments = await storage.getBillPayments(Number(req.params.id));
    res.json(payments);
  });

  app.get("/api/clients/:id/bill-payments", async (req, res) => {
    const payments = await storage.getClientBillPayments(Number(req.params.id));
    res.json(payments);
  });

  app.post("/api/bills/:id/pay", async (req, res) => {
    try {
      const { amount, paymentMethod, notes } = req.body;
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid payment amount is required" });
      }
      const result = await storage.payBill(Number(req.params.id), amount, paymentMethod, notes);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
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

  // Packing Workers routes
  app.get("/api/packing-workers", async (req, res) => {
    const workers = await storage.getPackingWorkers();
    res.json(workers.map(w => ({ id: w.id, name: w.name, active: w.active })));
  });

  app.get("/api/packing-workers/:id", async (req, res) => {
    const worker = await storage.getPackingWorker(Number(req.params.id));
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }
    res.json({ id: worker.id, name: worker.name, active: worker.active });
  });

  app.post("/api/packing-workers", async (req, res) => {
    const { name, pin } = req.body;
    if (!name || !pin || !/^\d{5}$/.test(pin)) {
      return res.status(400).json({ message: "Name and 5-digit PIN are required" });
    }
    try {
      const worker = await storage.createPackingWorker({ name, pin });
      res.status(201).json({ id: worker.id, name: worker.name, active: worker.active });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/packing-workers/:id", async (req, res) => {
    const { name, pin, active } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (pin !== undefined) {
      if (!/^\d{5}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 5 digits" });
      }
      updates.pin = pin;
    }
    if (active !== undefined) updates.active = active;
    
    try {
      const worker = await storage.updatePackingWorker(Number(req.params.id), updates);
      res.json({ id: worker.id, name: worker.name, active: worker.active });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/packing-workers/:id", async (req, res) => {
    await storage.deletePackingWorker(Number(req.params.id));
    res.status(204).send();
  });

  // Verify packing worker PIN
  app.post("/api/packing/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "Invalid PIN format" });
    }
    const worker = await storage.verifyPackingWorkerPin(pin);
    if (worker) {
      res.json({ success: true, worker: { id: worker.id, name: worker.name } });
    } else {
      res.status(401).json({ success: false, message: "Invalid PIN" });
    }
  });

  // Verify delivery worker PIN
  app.post("/api/delivery/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "Invalid PIN format" });
    }
    const worker = await storage.verifyDeliveryWorkerPin(pin);
    if (worker) {
      res.json({ success: true, worker: { id: worker.id, name: worker.name } });
    } else {
      res.status(401).json({ success: false, message: "Invalid PIN" });
    }
  });

  // Public order view by token (no auth required) - limited safe data only
  app.get("/api/orders/public/:token", async (req, res) => {
    const { token } = req.params;
    if (!token || token.length < 10) {
      return res.status(400).json({ message: "Invalid token" });
    }
    const order = await storage.getOrderByPublicToken(token);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    let clientName = order.customerName || "Customer";
    if (order.clientId) {
      const client = await storage.getClient(order.clientId);
      clientName = client?.name ? client.name.split(' ')[0] : clientName;
    }
    // Return only safe, non-sensitive fields for public view
    res.json({
      orderNumber: order.orderNumber,
      items: order.items,
      finalAmount: order.finalAmount,
      paidAmount: order.paidAmount,
      deliveryType: order.deliveryType,
      washingDone: order.washingDone,
      packingDone: order.packingDone,
      delivered: order.delivered,
      urgent: order.urgent,
      clientName
    });
  });

  // Generate public view token for order
  app.post("/api/orders/:id/generate-token", async (req, res) => {
    const orderId = Number(req.params.id);
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const order = await storage.updateOrder(orderId, { publicViewToken: token });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ token: order.publicViewToken });
  });

  // Incident Routes
  app.get("/api/incidents", async (req, res) => {
    const search = req.query.search as string | undefined;
    const incidents = await storage.getIncidents(search);
    res.json(incidents);
  });

  app.get("/api/incidents/:id", async (req, res) => {
    const incident = await storage.getIncident(Number(req.params.id));
    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }
    res.json(incident);
  });

  app.post("/api/incidents", async (req, res) => {
    try {
      const incident = await storage.createIncident(req.body);
      res.status(201).json(incident);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.updateIncident(Number(req.params.id), req.body);
      res.json(incident);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/incidents/:id", async (req, res) => {
    await storage.deleteIncident(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
