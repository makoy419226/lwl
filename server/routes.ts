import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { users, passwordResetTokens, stageChecklists } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendPasswordResetEmail, sendDailySalesReportEmail, type DailySalesData } from "./resend";
import PDFDocument from "pdfkit";

import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Seed database on startup
  await seedDatabase();

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, username),
          eq(users.password, password),
          eq(users.active, true),
        ),
      );

    if (user) {
      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
        },
      });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }
  });

  // Request password reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No user found with this email" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: resetCode,
      expiresAt,
      used: false,
    });

    try {
      await sendPasswordResetEmail(
        email,
        resetCode,
        user.name || user.username,
      );
      res.json({
        success: true,
        message: "Password reset code sent to your email",
      });
    } catch (err: any) {
      console.error("Failed to send email:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to send email. Please try again.",
        });
    }
  });

  // Verify reset code
  app.post("/api/auth/verify-reset-code", async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Email and code are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.token, code),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      );

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired code" });
    }

    res.json({ success: true, message: "Code verified successfully" });
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email, code, and new password are required",
        });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.token, code),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      );

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired code" });
    }

    await db
      .update(users)
      .set({ password: newPassword })
      .where(eq(users.id, user.id));
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, token.id));

    res.json({ success: true, message: "Password reset successfully" });
  });

  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    const userList = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        name: users.name,
        email: users.email,
        active: users.active,
      })
      .from(users);
    res.json(userList);
  });

  // Create user
  app.post("/api/users", async (req, res) => {
    const { username, password, role, name, email } = req.body;
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password,
          role: role || "cashier",
          name,
          email: email || null,
          active: true,
        })
        .returning();
      res
        .status(201)
        .json({
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          name: newUser.name,
          email: newUser.email,
        });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    const { username, password, role, name, email, active } = req.body;
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const updates: any = {};
    if (username) updates.username = username;
    if (password) updates.password = password;
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email || null;
    if (active !== undefined) updates.active = active;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: updated.id,
      username: updated.username,
      role: updated.role,
      name: updated.name,
      email: updated.email,
      active: updated.active,
    });
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    await db.delete(users).where(eq(users.id, userId));
    res.status(204).send();
  });

  // Client routes
  app.get(api.clients.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const clientList = await storage.getClients(search);
    res.json(clientList);
  });

  app.get(api.clients.get.path, async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json(client);
  });

  app.get("/api/clients/:id/unpaid-balance", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const unpaidBills = await storage.getUnpaidBills(clientId);

    let totalDue = 0;
    for (const bill of unpaidBills) {
      const amount = parseFloat(bill.amount?.toString() || "0");
      const paid = parseFloat(bill.paidAmount?.toString() || "0");
      totalDue += amount - paid;
    }

    res.json({
      totalDue: totalDue.toFixed(2),
      billCount: unpaidBills.length,
      latestBillDate: unpaidBills[0]?.billDate || null,
    });
  });

  app.post("/api/clients/check-duplicate", async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.json({ exists: false, client: null });
    }
    const existingClient = await storage.findClientByNameAndPhone(name, phone);
    res.json({ exists: !!existingClient, client: existingClient || null });
  });

  app.get("/api/clients/by-phone/:phone", async (req, res) => {
    const phone = req.params.phone;
    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }
    const client = await storage.findClientByPhone(phone);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json(client);
  });

  app.post(api.clients.create.path, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);

      // Check if phone number already exists (phone must be unique)
      if (input.phone) {
        const existingClientByPhone = await storage.findClientByPhone(input.phone);
        if (existingClientByPhone) {
          return res.status(409).json({
            message: `A client with phone number "${input.phone}" already exists`,
            field: "phone",
          });
        }
      }

      // Check for duplicate name + address combination
      if (input.name && input.address) {
        const existingClient = await storage.findClientByNameAndAddress(
          input.name,
          input.address,
        );
        if (existingClient) {
          return res.status(409).json({
            message: `A client with name "${input.name}" and address "${input.address}" already exists`,
            field: "address",
          });
        }
      }

      const client = await storage.createClient(input);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.put(api.clients.update.path, async (req, res) => {
    try {
      const input = api.clients.update.input.parse(req.body);
      const clientId = Number(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }

      // Get current client data for comparison
      const currentClient = await storage.getClient(clientId);
      if (!currentClient) {
        return res.status(404).json({ message: "Client not found" });
      }

      const newName = input.name || currentClient.name;
      const newPhone = input.phone || currentClient.phone;
      const newAddress = input.address || currentClient.address;

      // Check for duplicate name + phone combination (excluding current client)
      if (newPhone) {
        const existingClient = await storage.findClientByNameAndPhone(
          newName,
          newPhone,
          clientId,
        );
        if (existingClient) {
          return res.status(409).json({
            message: `A client with name "${newName}" and phone "${newPhone}" already exists`,
            field: "phone",
          });
        }
      }

      // Check for duplicate name + address combination (excluding current client)
      if (newAddress) {
        const existingClient = await storage.findClientByNameAndAddress(
          newName,
          newAddress,
          clientId,
        );
        if (existingClient) {
          return res.status(409).json({
            message: `A client with name "${newName}" and address "${newAddress}" already exists`,
            field: "address",
          });
        }
      }

      const client = await storage.updateClient(clientId, input);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete(api.clients.delete.path, async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    await storage.deleteClient(clientId);
    res.status(204).send();
  });

  // Product routes
  app.get(api.products.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const products = await storage.getProducts(search);
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const product = await storage.getProduct(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
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
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.put(api.products.update.path, async (req, res) => {
    try {
      const input = api.products.update.input.parse(req.body);
      const productId = Number(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      const product = await storage.updateProduct(productId, input);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete(api.products.delete.path, async (req, res) => {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    await storage.deleteProduct(productId);
    res.status(204).send();
  });

  // Get allocated stock for all products (from non-delivered orders)
  app.get("/api/products/allocated-stock", async (req, res) => {
    try {
      const allocatedStock = await storage.getAllocatedStock();
      res.json(allocatedStock);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Bill routes
  app.get(api.bills.list.path, async (req, res) => {
    const billList = await storage.getBills();
    res.json(billList);
  });

  app.get(api.bills.get.path, async (req, res) => {
    const billId = Number(req.params.id);
    if (isNaN(billId)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }
    const bill = await storage.getBill(billId);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
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
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete(api.bills.delete.path, async (req, res) => {
    const billId = Number(req.params.id);
    if (isNaN(billId)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }
    await storage.deleteBill(billId);
    res.status(204).send();
  });

  // Client bills routes
  app.get("/api/clients/:id/bills", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const bills = await storage.getClientBills(clientId);
    res.json(bills);
  });

  app.get("/api/clients/:id/unpaid-bills", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const bills = await storage.getUnpaidBills(clientId);
    res.json(bills);
  });

  app.get("/api/clients/:id/orders", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const clientOrders = await storage.getClientOrders(clientId);
    res.json(clientOrders);
  });

  // Delete all orders for a client
  app.delete("/api/clients/:id/orders", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    
    // Get all orders for this client
    const clientOrders = await storage.getClientOrders(clientId);
    
    // Delete each order
    for (const order of clientOrders) {
      await storage.deleteOrder(order.id);
    }
    
    // Also delete related bills for this client
    const clientBills = await storage.getClientBills(clientId);
    for (const bill of clientBills) {
      await storage.deleteBill(bill.id);
    }
    
    // Delete transactions for this client
    const transactions = await storage.getClientTransactions(clientId);
    for (const tx of transactions) {
      await storage.deleteClientTransaction(tx.id);
    }
    
    // Reset client balance
    await storage.updateClient(clientId, {
      amount: "0.00",
      deposit: "0.00",
      balance: "0.00",
    });
    
    res.json({ message: "All orders, bills, and transactions deleted for client" });
  });

  // Bill payments routes
  app.get("/api/bills/:id/payments", async (req, res) => {
    const billId = Number(req.params.id);
    if (isNaN(billId)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }
    const payments = await storage.getBillPayments(billId);
    res.json(payments);
  });

  app.get("/api/clients/:id/bill-payments", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const payments = await storage.getClientBillPayments(clientId);
    res.json(payments);
  });

  app.post("/api/bills/:id/pay", async (req, res) => {
    try {
      const { amount, paymentMethod, notes } = req.body;
      if (!amount || parseFloat(amount) <= 0) {
        return res
          .status(400)
          .json({ message: "Valid payment amount is required" });
      }
      const billId = Number(req.params.id);
      if (isNaN(billId)) {
        return res.status(400).json({ message: "Invalid bill ID" });
      }
      const result = await storage.payBill(
        billId,
        amount,
        paymentMethod,
        notes,
      );
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Transaction routes
  app.get("/api/clients/:id/transactions", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const transactions = await storage.getClientTransactions(clientId);
    res.json(transactions);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const transactionId = Number(req.params.id);
      if (isNaN(transactionId)) {
        return res.status(400).json({ message: "Invalid transaction ID" });
      }
      await storage.deleteClientTransaction(transactionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete transaction" });
    }
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const transactionId = Number(req.params.id);
      if (isNaN(transactionId)) {
        return res.status(400).json({ message: "Invalid transaction ID" });
      }
      const { amount, description } = req.body;
      const updated = await storage.updateClientTransaction(transactionId, { amount, description });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update transaction" });
    }
  });

  app.post("/api/clients/:id/bill", async (req, res) => {
    try {
      const { amount, description } = req.body;
      const clientId = Number(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const transaction = await storage.addClientBill(
        clientId,
        amount,
        description,
      );
      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/clients/:id/deposit", async (req, res) => {
    try {
      const { amount, description } = req.body;
      const clientId = Number(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const transaction = await storage.addClientDeposit(
        clientId,
        amount,
        description,
      );
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
    const dueSoon = allOrders.filter((order) => {
      if (!order.expectedDeliveryAt || order.delivered) return false;
      const timeDiff =
        new Date(order.expectedDeliveryAt).getTime() - now.getTime();
      const minutesLeft = timeDiff / (1000 * 60);
      return minutesLeft > 0 && minutesLeft <= windowMinutes;
    });
    res.json(dueSoon);
  });

  app.get("/api/orders/by-number/:orderNumber", async (req, res) => {
    const { orderNumber } = req.params;
    if (!orderNumber) {
      return res.status(400).json({ message: "Order number is required" });
    }
    // Find any order (not just delivered) for incident reporting
    const order = await storage.getOrderByNumber(orderNumber);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    let items: Array<{ name: string; quantity: number; price: number }> = [];
    if (order.items) {
      const trimmed = order.items.trim();
      // Try JSON parsing first
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            items = parsed.map((item: any) => ({
              name: item.name || item.productName || 'Unknown',
              quantity: item.quantity || item.qty || 1,
              price: parseFloat(item.price) || 0
            }));
          }
        } catch (e) {
          // Fall through to string parsing
        }
      }
      
      // String format parsing: "2x Shirt, 3x Pants" or "Shirt x2, Pants x3"
      if (items.length === 0) {
        items = trimmed.split(", ").map((itemStr: string) => {
          // Try "2x ProductName" format first
          const quantityFirstMatch = itemStr.match(/^(\d+)x\s+(.+)$/);
          if (quantityFirstMatch) {
            return { 
              name: quantityFirstMatch[2].trim(), 
              quantity: parseInt(quantityFirstMatch[1]),
              price: 0 
            };
          }
          
          // Try "ProductName x2" format
          const nameFirstMatch = itemStr.match(/^(.+)\s+x(\d+)$/);
          if (nameFirstMatch) {
            return { 
              name: nameFirstMatch[1].trim(), 
              quantity: parseInt(nameFirstMatch[2]),
              price: 0 
            };
          }
          
          // No quantity found, assume 1
          return { name: itemStr.trim(), quantity: 1, price: 0 };
        }).filter(item => item.name && item.name !== '');
      }
    }
    // Fetch client details if order has clientId
    let customerPhone = "";
    let customerAddress = "";
    if (order.clientId) {
      const client = await storage.getClient(order.clientId);
      if (client) {
        customerPhone = client.phone || "";
        customerAddress = client.address || "";
      }
    }
    
    res.json({ order, items, customerPhone, customerAddress });
  });

  app.get("/api/orders/:id", async (req, res) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  });

  app.post("/api/orders", async (req, res) => {
    try {
      let {
        customerName,
        customerPhone,
        deliveryAddress,
        createNewBill,
        billId: requestBillId,
      } = req.body;

      // // Validate required fields
      // if (!customerName || !customerName.trim()) {
      //   return res.status(400).json({ message: "Customer name is required" });
      // }
      // if (!customerPhone || !customerPhone.trim()) {
      //   return res.status(400).json({ message: "Customer phone is required" });
      // }

      // Check if customer already exists and auto-add to clients list if new
      let clientId = req.body.clientId;

      if (!clientId) {
        const existingClient = await storage.getClient(clientId);
        if (existingClient) {
          clientId = existingClient.id;
          customerName = existingClient.name;
          customerPhone = existingClient.phone;
        } else {
          // Validate required fields
          if (!customerName || !customerName.trim()) {
            return res
              .status(400)
              .json({ message: "Customer name is required" });
          }
          if (!customerPhone || !customerPhone.trim()) {
            return res
              .status(400)
              .json({ message: "Customer phone is required" });
          }
          // Auto-create new client
          const newClient = await storage.createClient({
            name: customerName.trim(),
            phone: customerPhone.trim(),
            email: "",
            address: deliveryAddress?.trim() || "",
          });
          clientId = newClient.id;
        }
      }

      let assignedBillId = req.body.requestBillId || null;

      const order = await storage.createOrder({
        ...req.body,
        clientId,
        billId: assignedBillId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
      });

      // Handle bill creation/attachment
      if (clientId && order.finalAmount) {
        const orderAmount = parseFloat(order.finalAmount.toString());

        if (requestBillId) {
          // User selected to attach to an existing bill - validate it
          const billIdNum = parseInt(requestBillId);
          if (isNaN(billIdNum)) {
            return res.status(400).json({ message: "Invalid bill ID" });
          }

          const existingBill = await storage.getBill(billIdNum);
          if (!existingBill) {
            return res.status(400).json({ message: "Bill not found" });
          }

          // Validate bill belongs to same client and is unpaid
          if (existingBill.clientId !== clientId) {
            return res
              .status(400)
              .json({ message: "Bill does not belong to this client" });
          }
          if (existingBill.isPaid) {
            return res
              .status(400)
              .json({ message: "Cannot add to a paid bill" });
          }

          const newAmount =
            parseFloat(existingBill.amount.toString()) + orderAmount;
          const existingDesc = existingBill.description || "";
          const newDesc = existingDesc
            ? `${existingDesc}\nOrder #${order.orderNumber}: ${order.items || "Items"}`
            : `Order #${order.orderNumber}: ${order.items || "Items"}`;

          await storage.updateBill(existingBill.id, {
            amount: newAmount.toFixed(2),
            description: newDesc,
          });
          assignedBillId = existingBill.id;
        } else if (createNewBill === true) {
          // User explicitly requested a new bill
          const newBill = await storage.createBill({
            clientId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            amount: orderAmount.toFixed(2),
            description: `Order #${order.orderNumber}: ${order.items || "Items"}`,
            billDate: new Date(),
            referenceNumber: `BILL-${order.orderNumber}`,
          });
          assignedBillId = newBill.id;
        } else {
          // Default behavior: add to existing unpaid bill or create new
          const unpaidBills = await storage.getUnpaidBills(clientId);

          if (unpaidBills.length > 0) {
            // Add to existing unpaid bill
            const existingBill = unpaidBills[0];
            const newAmount =
              parseFloat(existingBill.amount.toString()) + orderAmount;
            const existingDesc = existingBill.description || "";
            const newDesc = existingDesc
              ? `${existingDesc}\nOrder #${order.orderNumber}: ${order.items || "Items"}`
              : `Order #${order.orderNumber}: ${order.items || "Items"}`;

            await storage.updateBill(existingBill.id, {
              amount: newAmount.toFixed(2),
              description: newDesc,
            });
            assignedBillId = existingBill.id;
          } else {
            // Create new bill for this client
            const newBill = await storage.createBill({
              clientId,
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              amount: orderAmount.toFixed(2),
              description: `Order #${order.orderNumber}: ${order.items || "Items"}`,
              billDate: new Date(),
              referenceNumber: `BILL-${order.orderNumber}`,
            });
            assignedBillId = newBill.id;
          }
        }

        // Update order with billId if we assigned one
        if (assignedBillId && assignedBillId !== order.billId) {
          await storage.updateOrder(order.id, { billId: assignedBillId });
        }
      }

      // Update client address if delivery address is provided and different
      if (clientId && deliveryAddress && deliveryAddress.trim()) {
        const currentClient = await storage.getClient(clientId);
        if (currentClient && (!currentClient.address || currentClient.address !== deliveryAddress.trim())) {
          await storage.updateClient(clientId, {
            address: deliveryAddress.trim()
          });
        }
      }

      // Add stock immediately on order creation
      await storage.addStockForOrder(order.id);

      // Return order with updated billId
      const updatedOrder = await storage.getOrder(order.id);
      res.status(201).json(updatedOrder || order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      
      const order = await storage.updateOrder(orderId, req.body);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    // Deduct stock before deleting
    await storage.deductStockForOrder(orderId);
    await storage.deleteOrder(orderId);
    res.status(204).send();
  });

  // Reset all orders (admin password protected)
  app.post("/api/orders/reset-all", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      await storage.deleteAllOrders();
      res.json({ success: true, message: "All orders have been reset" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset orders: " + err.message });
    }
  });

  // Reset all transactions (admin password protected)
  app.post("/api/transactions/reset-all", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      await storage.deleteAllTransactions();
      res.json({ success: true, message: "All transactions have been reset" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset transactions: " + err.message });
    }
  });

  // Reset all bills (admin password protected)
  app.post("/api/bills/reset-all", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      await storage.deleteAllBills();
      res.json({ success: true, message: "All bills have been reset" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset bills: " + err.message });
    }
  });

  // Reset all clients (admin password protected)
  app.post("/api/clients/reset-all", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      await storage.deleteAllClients();
      res.json({ success: true, message: "All clients have been reset" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset clients: " + err.message });
    }
  });

  // Reset everything (admin password protected)
  app.post("/api/admin/reset-all", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      // Reset in proper order to handle foreign key constraints
      await storage.deleteAllOrders(); // This also resets product stock to 0
      await storage.deleteAllBills(); // This also clears transactions
      await storage.deleteAllClients(); // This clears clients and remaining transactions
      res.json({ success: true, message: "All data has been reset successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset all data: " + err.message });
    }
  });

  // Verify admin password
  app.post("/api/admin/verify", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }
    
    res.json({ success: true, message: "Admin verified" });
  });

  // Admin email for daily reports
  const ADMIN_REPORT_EMAIL = process.env.ADMIN_REPORT_EMAIL || "idusma0010@gmail.com";

  // Generate daily sales data
  async function generateDailySalesData(date: Date): Promise<DailySalesData> {
    const orders = await storage.getOrders();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const todaysOrders = orders.filter(order => {
      const orderDate = new Date(order.entryDate);
      return orderDate >= startOfDay && orderDate <= endOfDay;
    });
    
    const totalOrders = todaysOrders.length;
    const totalRevenue = todaysOrders.reduce((sum, o) => sum + parseFloat(o.finalAmount || "0"), 0);
    const paidAmount = todaysOrders.reduce((sum, o) => sum + parseFloat(o.paidAmount || "0"), 0);
    const pendingAmount = totalRevenue - paidAmount;
    const normalOrders = todaysOrders.filter(o => !o.urgent).length;
    const urgentOrders = todaysOrders.filter(o => o.urgent).length;
    const pickupOrders = todaysOrders.filter(o => o.deliveryType === "pickup").length;
    const deliveryOrders = todaysOrders.filter(o => o.deliveryType === "delivery").length;
    
    const itemCounts: Record<string, number> = {};
    todaysOrders.forEach(order => {
      const itemsMatch = order.items.match(/(\d+)x\s+([^,()]+)/g);
      if (itemsMatch) {
        itemsMatch.forEach(item => {
          const match = item.match(/(\d+)x\s+(.+)/);
          if (match) {
            const count = parseInt(match[1]);
            const name = match[2].trim();
            itemCounts[name] = (itemCounts[name] || 0) + count;
          }
        });
      }
    });
    
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    return {
      date: date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      totalOrders,
      totalRevenue,
      paidAmount,
      pendingAmount,
      normalOrders,
      urgentOrders,
      pickupOrders,
      deliveryOrders,
      topItems
    };
  }

  // Send daily sales report (admin protected)
  app.post("/api/admin/send-daily-report", async (req, res) => {
    const { adminPassword, date } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }
    
    try {
      const reportDate = date ? new Date(date) : new Date();
      const salesData = await generateDailySalesData(reportDate);
      await sendDailySalesReportEmail(ADMIN_REPORT_EMAIL, salesData);
      
      res.json({ 
        success: true, 
        message: `Daily sales report sent to ${ADMIN_REPORT_EMAIL}`,
        data: salesData
      });
    } catch (err: any) {
      console.error("Failed to send daily report:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send daily report: " + err.message 
      });
    }
  });

  // Get admin report email setting
  app.get("/api/admin/report-email", async (req, res) => {
    res.json({ email: ADMIN_REPORT_EMAIL });
  });

  // Packing Workers routes
  app.get("/api/packing-workers", async (req, res) => {
    const workers = await storage.getPackingWorkers();
    res.json(
      workers.map((w) => ({ id: w.id, name: w.name, active: w.active })),
    );
  });

  app.get("/api/packing-workers/:id", async (req, res) => {
    const workerId = Number(req.params.id);
    if (isNaN(workerId)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }
    const worker = await storage.getPackingWorker(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }
    res.json({ id: worker.id, name: worker.name, active: worker.active });
  });

  app.post("/api/packing-workers", async (req, res) => {
    const { name, pin } = req.body;
    if (!name || !pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ message: "Name and 5-digit PIN are required" });
    }
    try {
      const worker = await storage.createPackingWorker({ name, pin });
      res
        .status(201)
        .json({ id: worker.id, name: worker.name, active: worker.active });
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
      const workerId = Number(req.params.id);
      if (isNaN(workerId)) {
        return res.status(400).json({ message: "Invalid worker ID" });
      }
      const worker = await storage.updatePackingWorker(workerId, updates);
      res.json({ id: worker.id, name: worker.name, active: worker.active });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/packing-workers/:id", async (req, res) => {
    const workerId = Number(req.params.id);
    if (isNaN(workerId)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }
    await storage.deletePackingWorker(workerId);
    res.status(204).send();
  });

  // Verify staff user PIN (for bill creation, etc.)
  app.post("/api/workers/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
    }
    const user = await storage.verifyUserPin(pin);
    if (user) {
      res.json({ success: true, worker: { id: user.id, name: user.name || user.username } });
    } else {
      res.status(401).json({ success: false, message: "Invalid PIN" });
    }
  });

  // Verify packing worker PIN
  app.post("/api/packing/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
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
      clientName = client?.name ? client.name.split(" ")[0] : clientName;
    }
    // Return only safe, non-sensitive fields for public view
    res.json({
      orderNumber: order.orderNumber,
      items: order.items,
      finalAmount: order.finalAmount || order.totalAmount,
      paidAmount: order.paidAmount,
      deliveryType: order.deliveryType,
      washingDone: order.washingDone,
      packingDone: order.packingDone,
      delivered: order.delivered,
      urgent: order.urgent,
      clientName,
    });
  });

  // Public order tracking by order number (no auth required) - limited safe data only
  app.get("/api/orders/track/:orderNumber", async (req, res) => {
    const { orderNumber } = req.params;
    if (!orderNumber || orderNumber.length < 1) {
      return res.status(400).json({ message: "Invalid order number" });
    }
    const order = await storage.getOrderByNumber(orderNumber.toUpperCase());
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    // Return only safe, non-sensitive fields for public view (no financial data, no personal details)
    res.json({
      orderNumber: order.orderNumber,
      items: order.items,
      status: order.status,
      entryDate: order.entryDate,
      deliveryType: order.deliveryType,
      tagDone: order.tagDone,
      washingDone: order.washingDone,
      packingDone: order.packingDone,
      delivered: order.delivered,
      urgent: order.urgent,
      expectedDeliveryAt: order.expectedDeliveryAt,
    });
  });

  // Generate public view token for order
  app.post("/api/orders/:id/generate-token", async (req, res) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const token =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const order = await storage.updateOrder(orderId, {
      publicViewToken: token,
    });
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
    const incidentId = Number(req.params.id);
    if (isNaN(incidentId)) {
      return res.status(400).json({ message: "Invalid incident ID" });
    }
    const incident = await storage.getIncident(incidentId);
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
      const incidentId = Number(req.params.id);
      if (isNaN(incidentId)) {
        return res.status(400).json({ message: "Invalid incident ID" });
      }
      const incident = await storage.updateIncident(incidentId, req.body);
      res.json(incident);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/incidents/:id", async (req, res) => {
    const incidentId = Number(req.params.id);
    if (isNaN(incidentId)) {
      return res.status(400).json({ message: "Invalid incident ID" });
    }
    await storage.deleteIncident(incidentId);
    res.status(204).send();
  });

  // Missing Items Routes
  app.get("/api/missing-items", async (req, res) => {
    const search = req.query.search as string | undefined;
    const items = await storage.getMissingItems(search);
    res.json(items);
  });

  app.get("/api/missing-items/:id", async (req, res) => {
    const itemId = Number(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }
    const item = await storage.getMissingItem(itemId);
    if (!item) {
      return res.status(404).json({ message: "Missing item not found" });
    }
    res.json(item);
  });

  app.post("/api/missing-items", async (req, res) => {
    try {
      const item = await storage.createMissingItem(req.body);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/missing-items/:id", async (req, res) => {
    try {
      const itemId = Number(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      const item = await storage.updateMissingItem(itemId, req.body);
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/missing-items/:id", async (req, res) => {
    const itemId = Number(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }
    await storage.deleteMissingItem(itemId);
    res.status(204).send();
  });

  // Stage Checklists Routes
  app.get("/api/stage-checklists/order/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const checklists = await db
      .select()
      .from(stageChecklists)
      .where(eq(stageChecklists.orderId, orderId));
    res.json(checklists);
  });

  app.get("/api/stage-checklists/order/:orderId/:stage", async (req, res) => {
    const orderId = Number(req.params.orderId);
    const stage = req.params.stage;
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const [checklist] = await db
      .select()
      .from(stageChecklists)
      .where(
        and(
          eq(stageChecklists.orderId, orderId),
          eq(stageChecklists.stage, stage)
        )
      );
    res.json(checklist || null);
  });

  app.post("/api/stage-checklists", async (req, res) => {
    try {
      const { orderId, stage, totalItems, workerName, workerId } = req.body;
      
      // Check if checklist already exists for this order and stage
      const [existing] = await db
        .select()
        .from(stageChecklists)
        .where(
          and(
            eq(stageChecklists.orderId, orderId),
            eq(stageChecklists.stage, stage)
          )
        );
      
      if (existing) {
        return res.json(existing);
      }
      
      const [checklist] = await db
        .insert(stageChecklists)
        .values({
          orderId,
          stage,
          totalItems,
          checkedItems: "[]",
          checkedCount: 0,
          isComplete: false,
          startedAt: new Date(),
          workerId,
          workerName,
        })
        .returning();
      res.status(201).json(checklist);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/stage-checklists/:id", async (req, res) => {
    try {
      const checklistId = Number(req.params.id);
      if (isNaN(checklistId)) {
        return res.status(400).json({ message: "Invalid checklist ID" });
      }
      
      const { checkedItems, checkedCount, isComplete, workerId, workerName } = req.body;
      const updates: any = {};
      
      if (checkedItems !== undefined) updates.checkedItems = checkedItems;
      if (checkedCount !== undefined) updates.checkedCount = checkedCount;
      if (isComplete !== undefined) {
        updates.isComplete = isComplete;
        if (isComplete) {
          updates.completedAt = new Date();
        }
      }
      if (workerId !== undefined) updates.workerId = workerId;
      if (workerName !== undefined) updates.workerName = workerName;
      
      const [checklist] = await db
        .update(stageChecklists)
        .set(updates)
        .where(eq(stageChecklists.id, checklistId))
        .returning();
      
      if (!checklist) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json(checklist);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/stage-checklists/order/:orderId/:stage/toggle", async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const stage = req.params.stage;
      const { itemIndex, checked, workerId, workerName } = req.body;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      
      // Get or create checklist
      let [checklist] = await db
        .select()
        .from(stageChecklists)
        .where(
          and(
            eq(stageChecklists.orderId, orderId),
            eq(stageChecklists.stage, stage)
          )
        );
      
      if (!checklist) {
        return res.status(404).json({ message: "Checklist not found. Create it first." });
      }
      
      // Parse checked items and update
      let items: number[] = [];
      try {
        items = JSON.parse(checklist.checkedItems || "[]");
      } catch (e) {
        items = [];
      }
      
      if (checked && !items.includes(itemIndex)) {
        items.push(itemIndex);
      } else if (!checked) {
        items = items.filter(i => i !== itemIndex);
      }
      
      const checkedCount = items.length;
      const isComplete = checkedCount >= checklist.totalItems;
      
      const [updated] = await db
        .update(stageChecklists)
        .set({
          checkedItems: JSON.stringify(items),
          checkedCount,
          isComplete,
          completedAt: isComplete ? new Date() : null,
          workerId: workerId || checklist.workerId,
          workerName: workerName || checklist.workerName,
        })
        .where(eq(stageChecklists.id, checklist.id))
        .returning();
      
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get incomplete checklists (for supervisor alerts)
  app.get("/api/stage-checklists/incomplete", async (req, res) => {
    const incomplete = await db
      .select()
      .from(stageChecklists)
      .where(eq(stageChecklists.isComplete, false));
    res.json(incomplete);
  });

  // Generate System Flowchart PDF
  app.get("/api/system-flowchart", async (req, res) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="LiquidWashes_System_Flowchart.pdf"',
    );
    doc.pipe(res);

    const pageWidth = 595.28;
    const contentWidth = pageWidth - 80;
    const centerX = pageWidth / 2;
    let currentY = 40;

    const colors = {
      primary: "#3B82F6",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#EF4444",
      purple: "#8B5CF6",
      cyan: "#06B6D4",
      gray: "#6B7280",
      lightGray: "#F3F4F6",
    };

    const drawBox = (
      x: number,
      y: number,
      width: number,
      height: number,
      text: string,
      color: string,
      isRounded = true,
    ) => {
      doc
        .roundedRect(x, y, width, height, isRounded ? 8 : 0)
        .fillAndStroke(color, color);
      doc
        .fillColor("white")
        .fontSize(9)
        .text(text, x + 5, y + height / 2 - 5, {
          width: width - 10,
          align: "center",
        });
      doc.fillColor("black");
    };

    const drawDiamond = (
      x: number,
      y: number,
      size: number,
      text: string,
      color: string,
    ) => {
      doc
        .save()
        .translate(x + size / 2, y + size / 2)
        .rotate(45)
        .rect(-size / 2.8, -size / 2.8, size / 1.4, size / 1.4)
        .fillAndStroke(color, color)
        .restore();
      doc
        .fillColor("white")
        .fontSize(7)
        .text(text, x - 5, y + size / 2 - 5, { width: size + 10, align: "center" });
      doc.fillColor("black");
    };

    const drawArrow = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color = "#374151",
    ) => {
      doc.strokeColor(color).lineWidth(1.5).moveTo(x1, y1).lineTo(x2, y2).stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLength = 8;
      doc
        .moveTo(x2, y2)
        .lineTo(
          x2 - arrowLength * Math.cos(angle - Math.PI / 6),
          y2 - arrowLength * Math.sin(angle - Math.PI / 6),
        )
        .lineTo(
          x2 - arrowLength * Math.cos(angle + Math.PI / 6),
          y2 - arrowLength * Math.sin(angle + Math.PI / 6),
        )
        .lineTo(x2, y2)
        .fill(color);
    };

    const drawSectionTitle = (title: string, y: number) => {
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor(colors.primary)
        .text(title, 40, y, { width: contentWidth, align: "center" });
      doc.font("Helvetica");
      return y + 25;
    };

    // Cover Page
    doc
      .fontSize(28)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("LIQUID WASHES LAUNDRY", 40, 150, {
        width: contentWidth,
        align: "center",
      });
    doc.fontSize(20).fillColor(colors.gray).text("System Flowchart", 40, 190, {
      width: contentWidth,
      align: "center",
    });
    doc
      .fontSize(12)
      .text("Comprehensive Business Process Documentation", 40, 230, {
        width: contentWidth,
        align: "center",
      });

    doc
      .roundedRect(centerX - 150, 280, 300, 200, 10)
      .fillAndStroke(colors.lightGray, colors.primary);
    doc.fillColor(colors.gray).fontSize(11);
    const features = [
      "Order Management & Workflow",
      "Client & Financial Tracking",
      "Inventory Management",
      "Billing & Invoice System",
      "Staff PIN Verification",
      "Reports & Analytics",
      "Role-Based Authentication",
      "WhatsApp Integration",
    ];
    features.forEach((feature, i) => {
      doc.text(`• ${feature}`, centerX - 130, 295 + i * 22);
    });

    doc.fontSize(10).fillColor(colors.gray);
    doc.text("Contact: +971 50 123 4567", 40, 520, {
      width: contentWidth,
      align: "center",
    });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 535, {
      width: contentWidth,
      align: "center",
    });

    // PAGE 2: Authentication Flow
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("1. AUTHENTICATION SYSTEM", 40, currentY);
    currentY += 40;

    drawBox(centerX - 60, currentY, 120, 30, "User Opens App", colors.gray);
    currentY += 30;
    drawArrow(centerX, currentY, centerX, currentY + 20);
    currentY += 20;

    drawDiamond(centerX - 25, currentY, 50, "Logged In?", colors.warning);
    currentY += 50;

    // Left branch - Not logged in
    drawArrow(centerX - 25, currentY - 25, centerX - 100, currentY - 25);
    drawArrow(centerX - 100, currentY - 25, centerX - 100, currentY + 10);
    drawBox(centerX - 160, currentY + 10, 120, 30, "Show Login Page", colors.cyan);

    drawArrow(centerX - 100, currentY + 40, centerX - 100, currentY + 60);
    drawBox(
      centerX - 165,
      currentY + 60,
      130,
      30,
      "Enter Username & Password",
      colors.gray,
    );

    drawArrow(centerX - 100, currentY + 90, centerX - 100, currentY + 110);
    drawDiamond(centerX - 125, currentY + 110, 50, "Valid?", colors.warning);

    drawArrow(centerX - 100, currentY + 160, centerX - 100, currentY + 180);
    drawBox(centerX - 160, currentY + 180, 120, 30, "Store Session", colors.success);

    // Right branch - Already logged in
    drawArrow(centerX + 25, currentY - 25, centerX + 100, currentY - 25);
    drawArrow(centerX + 100, currentY - 25, centerX + 100, currentY + 180);
    drawBox(centerX + 40, currentY + 180, 120, 30, "Load Dashboard", colors.success);

    currentY += 240;
    doc.fontSize(10).fillColor(colors.gray);
    doc.text("Password Reset Flow:", 40, currentY);
    currentY += 15;
    doc.text(
      "1. User clicks 'Forgot Password' → 2. Enter email → 3. Receive 6-digit code via email",
      50,
      currentY,
    );
    currentY += 12;
    doc.text(
      "4. Enter verification code → 5. Set new password → 6. Login with new credentials",
      50,
      currentY,
    );

    currentY += 30;
    doc.text("User Roles:", 40, currentY);
    currentY += 15;
    doc.text("• Admin: Full system access, user management, all reports", 50, currentY);
    currentY += 12;
    doc.text(
      "• Manager: Order management, billing, inventory, limited reports",
      50,
      currentY,
    );
    currentY += 12;
    doc.text("• Cashier: Order creation, billing, basic operations", 50, currentY);

    // PAGE 3: Order Workflow
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("2. ORDER WORKFLOW (Main Business Process)", 40, currentY);
    currentY += 40;

    // Stage 1: Create Order
    drawBox(40, currentY, 120, 35, "1. CREATE ORDER", colors.primary);
    doc.fontSize(8).fillColor(colors.gray);
    doc.text("• Select/Create Client", 45, currentY + 40);
    doc.text("• Enter phone (required)", 45, currentY + 50);
    doc.text("• Add laundry items", 45, currentY + 60);
    doc.text("• Set delivery date", 45, currentY + 70);
    doc.text("• Stock auto-deducted", 45, currentY + 80);

    drawArrow(160, currentY + 17, 190, currentY + 17);

    // Stage 2: Tag PIN
    drawBox(190, currentY, 110, 35, "2. TAG PIN", colors.warning);
    doc.text("• Enter staff PIN", 195, currentY + 40);
    doc.text("• Print tag (A5)", 195, currentY + 50);
    doc.text("• Attach to clothes", 195, currentY + 60);
    doc.text("• Auto-navigate next", 195, currentY + 70);

    drawArrow(300, currentY + 17, 330, currentY + 17);

    // Stage 3: Packing
    drawBox(330, currentY, 100, 35, "3. PACKING", colors.purple);
    doc.text("• Enter packing PIN", 335, currentY + 40);
    doc.text("• Mark items packed", 335, currentY + 50);
    doc.text("• Quality check", 335, currentY + 60);

    drawArrow(430, currentY + 17, 460, currentY + 17);

    // Stage 4: Delivery
    drawBox(460, currentY, 95, 35, "4. DELIVERY", colors.success);
    doc.text("• Enter delivery PIN", 465, currentY + 40);
    doc.text("• Upload proof photo", 465, currentY + 50);
    doc.text("• Print invoice", 465, currentY + 60);
    doc.text("• Complete order", 465, currentY + 70);

    currentY += 110;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary);
    doc.text("Staff PIN Verification at Each Stage:", 40, currentY);
    currentY += 20;

    doc.fontSize(9).font("Helvetica").fillColor(colors.gray);
    const pinSteps = [
      "1. Staff enters 5-digit PIN when completing any stage",
      "2. System verifies PIN against worker database",
      "3. Worker name & timestamp recorded for accountability",
      "4. System auto-navigates to next pending order in queue",
    ];
    pinSteps.forEach((step, i) => {
      doc.text(step, 50, currentY + i * 14);
    });

    currentY += 80;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary);
    doc.text("Order Status Tracking:", 40, currentY);
    currentY += 20;

    const statuses = [
      { name: "Pending", color: colors.warning, desc: "Order created, awaiting tag" },
      { name: "Washing", color: colors.cyan, desc: "Tag complete, in laundry" },
      { name: "Ready", color: colors.purple, desc: "Packing done, ready for delivery" },
      { name: "Delivered", color: colors.success, desc: "Order completed" },
    ];

    statuses.forEach((status, i) => {
      drawBox(50 + i * 130, currentY, 100, 25, status.name, status.color);
      doc.fontSize(7).fillColor(colors.gray);
      doc.text(status.desc, 50 + i * 130, currentY + 30, {
        width: 100,
        align: "center",
      });
    });

    // PAGE 4: Client Management
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("3. CLIENT MANAGEMENT", 40, currentY);
    currentY += 40;

    drawBox(centerX - 60, currentY, 120, 30, "Clients Module", colors.primary);
    currentY += 50;

    // Three branches
    const clientActions = [
      { title: "Add Client", items: ["Name", "Phone (required)", "Address", "Notes"] },
      {
        title: "View Client",
        items: ["Order history", "Balance due", "Transaction log", "Total spent"],
      },
      {
        title: "Manage Balance",
        items: ["Add payment", "Record credit", "View unpaid bills", "Export statement"],
      },
    ];

    clientActions.forEach((action, i) => {
      const x = 60 + i * 180;
      drawArrow(
        centerX,
        currentY - 20,
        x + 60,
        currentY - 20 + (i === 1 ? 0 : 20),
      );
      drawBox(x, currentY, 120, 30, action.title, colors.cyan);
      doc.fontSize(8).fillColor(colors.gray);
      action.items.forEach((item, j) => {
        doc.text(`• ${item}`, x + 5, currentY + 35 + j * 12);
      });
    });

    currentY += 120;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary);
    doc.text("Client Transaction Flow:", 40, currentY);
    currentY += 25;

    drawBox(50, currentY, 100, 30, "Bill Created", colors.warning);
    drawArrow(150, currentY + 15, 180, currentY + 15);
    drawBox(180, currentY, 100, 30, "Balance Updated", colors.cyan);
    drawArrow(280, currentY + 15, 310, currentY + 15);
    drawBox(310, currentY, 100, 30, "Payment Made", colors.purple);
    drawArrow(410, currentY + 15, 440, currentY + 15);
    drawBox(440, currentY, 100, 30, "Balance Reduced", colors.success);

    // PAGE 5: Billing System
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("4. BILLING & INVOICE SYSTEM", 40, currentY);
    currentY += 40;

    drawBox(centerX - 60, currentY, 120, 30, "Create Bill", colors.primary);
    currentY += 50;

    doc.fontSize(9).fillColor(colors.gray);
    doc.text("Bill Creation Process:", 40, currentY);
    currentY += 15;

    const billSteps = [
      "1. Select client from dropdown",
      "2. Choose linked order (optional)",
      "3. Add bill items with quantities & prices",
      "4. Apply discount if applicable",
      "5. Enter staff PIN for verification",
      "6. Save bill & update client balance",
    ];
    billSteps.forEach((step, i) => {
      doc.text(step, 50, currentY + i * 14);
    });

    currentY += 100;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary);
    doc.text("Bill Actions:", 40, currentY);
    currentY += 25;

    const billActions = [
      { title: "Download PDF", color: colors.cyan },
      { title: "Thermal Print", color: colors.warning },
      { title: "WhatsApp Share", color: colors.success },
      { title: "Mark as Paid", color: colors.purple },
    ];

    billActions.forEach((action, i) => {
      drawBox(50 + i * 130, currentY, 110, 30, action.title, action.color);
    });

    currentY += 60;
    doc.fontSize(10).fillColor(colors.gray);
    doc.text("Bidirectional Linking: Bills can be linked to Orders and vice versa.", 40, currentY);
    doc.text(
      "Client balance automatically updates when bills are created or payments received.",
      40,
      currentY + 14,
    );

    // PAGE 6: Inventory
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("5. INVENTORY MANAGEMENT", 40, currentY);
    currentY += 40;

    drawBox(centerX - 60, currentY, 120, 30, "Inventory Module", colors.primary);
    currentY += 50;

    doc.fontSize(9).fillColor(colors.gray);
    doc.text("47 Pre-seeded Laundry Items:", 40, currentY);
    currentY += 15;

    const categories = [
      "Clothing (shirts, pants, dresses, etc.)",
      "Bedding (sheets, pillowcases, comforters)",
      "Household (towels, curtains, tablecloths)",
      "Specialty (suits, wedding dresses, leather)",
    ];
    categories.forEach((cat, i) => {
      doc.text(`• ${cat}`, 50, currentY + i * 14);
    });

    currentY += 70;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary);
    doc.text("Stock Flow:", 40, currentY);
    currentY += 25;

    drawBox(50, currentY, 110, 30, "Add Stock", colors.success);
    drawArrow(160, currentY + 15, 190, currentY + 15);
    drawBox(190, currentY, 120, 30, "Current Quantity", colors.cyan);
    drawArrow(310, currentY + 15, 340, currentY + 15);
    drawBox(340, currentY, 120, 30, "Order Created", colors.warning);
    drawArrow(460, currentY + 15, 490, currentY + 15);
    drawBox(490, currentY - 5, 50, 40, "-Stock", colors.danger);

    currentY += 60;
    doc.fontSize(9).fillColor(colors.gray);
    doc.text("• Stock is automatically deducted when orders are created", 50, currentY);
    doc.text("• Low stock alerts appear on dashboard", 50, currentY + 14);
    doc.text("• Upload product images for visual identification", 50, currentY + 28);

    // PAGE 7: Reports
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("6. REPORTS & ANALYTICS", 40, currentY);
    currentY += 40;

    const reportTypes = [
      {
        title: "Sales Report",
        items: [
          "Daily/Weekly/Monthly sales",
          "Revenue breakdown",
          "Top selling items",
          "Export to Excel/PDF",
        ],
      },
      {
        title: "Due Customers",
        items: [
          "Outstanding balances",
          "Aging analysis",
          "Contact details",
          "Quick bill creation",
        ],
      },
      {
        title: "Staff Performance",
        items: [
          "Orders completed per worker",
          "Average completion time",
          "PIN verification logs",
          "Productivity trends",
        ],
      },
    ];

    reportTypes.forEach((report, i) => {
      drawBox(40, currentY + i * 100, 140, 30, report.title, colors.primary);
      doc.fontSize(8).fillColor(colors.gray);
      report.items.forEach((item, j) => {
        doc.text(`• ${item}`, 190, currentY + i * 100 + 5 + j * 12);
      });
    });

    // PAGE 8: System Overview
    doc.addPage();
    currentY = 40;
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text("7. COMPLETE SYSTEM OVERVIEW", 40, currentY);
    currentY += 40;

    // Main flow diagram
    const modules = [
      { name: "Login", x: centerX - 50, y: currentY, color: colors.gray },
      { name: "Dashboard", x: centerX - 50, y: currentY + 60, color: colors.primary },
      { name: "Orders", x: 60, y: currentY + 130, color: colors.warning },
      { name: "Clients", x: 180, y: currentY + 130, color: colors.cyan },
      { name: "Inventory", x: 300, y: currentY + 130, color: colors.purple },
      { name: "Bills", x: 420, y: currentY + 130, color: colors.success },
      { name: "Reports", x: centerX - 50, y: currentY + 200, color: colors.danger },
      { name: "Workers", x: 180, y: currentY + 200, color: colors.gray },
      { name: "Incidents", x: 320, y: currentY + 200, color: colors.warning },
    ];

    modules.forEach((m) => {
      drawBox(m.x, m.y, 100, 30, m.name, m.color);
    });

    // Draw connecting arrows
    drawArrow(centerX, currentY + 30, centerX, currentY + 60);
    drawArrow(centerX, currentY + 90, 110, currentY + 130);
    drawArrow(centerX, currentY + 90, 230, currentY + 130);
    drawArrow(centerX, currentY + 90, 350, currentY + 130);
    drawArrow(centerX, currentY + 90, 470, currentY + 130);

    currentY += 250;
    doc.fontSize(10).fillColor(colors.gray);
    doc.text("All modules interconnected through shared database", 40, currentY, {
      width: contentWidth,
      align: "center",
    });

    currentY += 30;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary);
    doc.text("Technical Stack:", 40, currentY);
    currentY += 20;
    doc.fontSize(9).font("Helvetica").fillColor(colors.gray);
    doc.text("• Frontend: React + TypeScript + Tailwind CSS + shadcn/ui", 50, currentY);
    doc.text("• Backend: Express.js + Node.js", 50, currentY + 12);
    doc.text("• Database: PostgreSQL with Drizzle ORM", 50, currentY + 24);
    doc.text("• Email: Resend for password reset", 50, currentY + 36);
    doc.text("• Documents: A5 format for all prints/PDFs", 50, currentY + 48);

    doc.end();
  });

  // Global search endpoint
  app.get("/api/search", async (req, res) => {
    const q = String(req.query.q || "").toLowerCase().trim();
    if (!q) {
      return res.json([]);
    }

    const results: Array<{
      id: number;
      type: "order" | "client" | "product" | "bill";
      title: string;
      subtitle?: string;
      status?: string;
    }> = [];

    try {
      // Search orders
      const orders = await storage.getOrders();
      const matchedOrders = orders
        .filter(o => 
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q)
        )
        .slice(0, 5);
      
      for (const o of matchedOrders) {
        results.push({
          id: o.id,
          type: "order",
          title: `Order #${o.orderNumber}`,
          subtitle: o.customerName || undefined,
          status: o.delivered ? "Released" : o.packingDone ? "Ready" : o.washingDone ? "Washing" : o.tagDone ? "Tag" : "Received",
        });
      }

      // Search clients
      const clients = await storage.getClients();
      const matchedClients = clients
        .filter(c => 
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
        .slice(0, 5);
      
      for (const c of matchedClients) {
        results.push({
          id: c.id,
          type: "client",
          title: c.name,
          subtitle: c.phone || c.email || undefined,
        });
      }

      // Search products
      const products = await storage.getProducts();
      const matchedProducts = products
        .filter(p => 
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        )
        .slice(0, 5);
      
      for (const p of matchedProducts) {
        results.push({
          id: p.id,
          type: "product",
          title: p.name,
          subtitle: p.category || undefined,
        });
      }

      // Search bills
      const bills = await storage.getBills();
      const matchedBills = bills
        .filter(b => 
          b.referenceNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
        )
        .slice(0, 5);
      
      for (const b of matchedBills) {
        results.push({
          id: b.id,
          type: "bill",
          title: `Bill #${b.referenceNumber || b.id}`,
          subtitle: b.customerName || undefined,
          status: b.isPaid ? "Paid" : "Unpaid",
        });
      }

      res.json(results.slice(0, 15));
    } catch (err) {
      console.error("Search error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  return httpServer;
}
