import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { users, passwordResetTokens } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendPasswordResetEmail } from "./resend";

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
    const { password, role, name, email, active } = req.body;
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const updates: any = {};
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

  app.post(api.clients.create.path, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);

      // Check for duplicate name + phone combination
      if (input.name && input.phone) {
        const existingClient = await storage.findClientByNameAndPhone(
          input.name,
          input.phone,
        );
        if (existingClient) {
          return res.status(409).json({
            message: `A client with name "${input.name}" and phone "${input.phone}" already exists`,
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
            address: "",
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

  return httpServer;
}
