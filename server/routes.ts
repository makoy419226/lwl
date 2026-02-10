import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { users, passwordResetTokens, stageChecklists, packingWorkers, bills, orders, clientTransactions, billPayments } from "@shared/schema";
import { eq, and, gt, ne } from "drizzle-orm";
import { sendPasswordResetEmail } from "./resend";
import { sendDailySalesReportEmailSMTP, sendSalesReportEmailSMTP, type DailySalesData, type SalesReportData, type ReportPeriod } from "./smtp";
import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";

import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Seed database on startup
  await seedDatabase();

  // Active session tracking (in-memory, stores userId -> lastActivity timestamp)
  const activeSessions = new Map<number, { userId: number; username: string; lastActivity: Date }>();
  const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes - user is considered offline after this
  
  // Force logout tracking - stores userIds that should be logged out on next heartbeat
  const forceLogoutUsers = new Set<number>();
  
  // SSE connections for instant logout notification
  const sseClients = new Map<number, Response[]>();
  
  // SSE endpoint for logout notifications
  app.get("/api/auth/logout-stream", (req, res) => {
    const userId = parseInt(req.query.userId as string);
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();
    
    // Add this client to the list
    if (!sseClients.has(userId)) {
      sseClients.set(userId, []);
    }
    sseClients.get(userId)!.push(res);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    
    // Check if user should already be logged out
    if (forceLogoutUsers.has(userId)) {
      res.write(`data: ${JSON.stringify({ type: "forceLogout" })}\n\n`);
      forceLogoutUsers.delete(userId);
    }
    
    // Cleanup on disconnect
    req.on("close", () => {
      const clients = sseClients.get(userId);
      if (clients) {
        const index = clients.indexOf(res);
        if (index > -1) {
          clients.splice(index, 1);
        }
        if (clients.length === 0) {
          sseClients.delete(userId);
        }
      }
    });
  });

  // Heartbeat endpoint - called periodically by logged-in users
  app.post("/api/auth/heartbeat", async (req, res) => {
    const { userId, username } = req.body;
    if (userId) {
      // Check if user should be force logged out
      if (forceLogoutUsers.has(userId)) {
        forceLogoutUsers.delete(userId);
        activeSessions.delete(userId);
        return res.json({ success: false, forceLogout: true, message: "Session terminated by admin" });
      }
      
      activeSessions.set(userId, {
        userId,
        username: username || "",
        lastActivity: new Date()
      });
    }
    res.json({ success: true });
  });

  // Get active sessions (for admin to see who's online)
  app.get("/api/auth/active-sessions", async (req, res) => {
    const now = new Date();
    const activeUserIds: number[] = [];
    
    // Clean up stale sessions and collect active ones
    for (const [userId, session] of activeSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
        activeSessions.delete(userId);
      } else {
        activeUserIds.push(userId);
      }
    }
    
    res.json({ activeUserIds });
  });

  // Force logout all non-admin users (admin only)
  app.post("/api/admin/logout-all-users", async (req, res) => {
    const { adminPassword } = req.body;
    
    if (!adminPassword) {
      return res.status(400).json({ success: false, message: "Admin password required" });
    }
    
    // Verify admin password from database
    const adminUser = await storage.getUserByUsername("admin");
    const correctPassword = adminUser?.password || process.env.ADMIN_PASSWORD || "admin123";
    
    if (adminPassword !== correctPassword) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }
    
    // Get all non-admin users and mark them for force logout
    const allUsers = await storage.getUsers();
    let loggedOutCount = 0;
    
    for (const user of allUsers) {
      if (user.username !== "admin" && user.role !== "admin") {
        forceLogoutUsers.add(user.id);
        activeSessions.delete(user.id);
        loggedOutCount++;
        
        // Send instant logout notification via SSE
        const clients = sseClients.get(user.id);
        if (clients && clients.length > 0) {
          clients.forEach(client => {
            try {
              client.write(`data: ${JSON.stringify({ type: "forceLogout" })}\n\n`);
            } catch (e) {
              // Client disconnected
            }
          });
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `${loggedOutCount} user sessions logged out instantly`,
      loggedOutCount 
    });
  });

  // Delete all non-admin users (admin only)
  app.post("/api/admin/delete-all-users", async (req, res) => {
    const { adminPassword } = req.body;
    
    if (!adminPassword) {
      return res.status(400).json({ success: false, message: "Admin password required" });
    }
    
    // Verify admin password from database
    const adminUser = await storage.getUserByUsername("admin");
    const correctPassword = adminUser?.password || process.env.ADMIN_PASSWORD || "admin123";
    
    if (adminPassword !== correctPassword) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }
    
    // Get all non-admin users and delete them
    const allUsers = await storage.getUsers();
    let deletedCount = 0;
    
    for (const user of allUsers) {
      if (user.username !== "admin" && user.role !== "admin") {
        await storage.deleteUser(user.id);
        // Clean up any active sessions
        forceLogoutUsers.delete(user.id);
        activeSessions.delete(user.id);
        deletedCount++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `${deletedCount} user accounts deleted`,
      deletedCount 
    });
  });

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

  // Get all users (admin only) - includes password and PIN for admin view
  app.get("/api/users", async (req, res) => {
    const userList = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        name: users.name,
        email: users.email,
        pin: users.pin,
        active: users.active,
      })
      .from(users);
    res.json(userList);
  });

  // Create user
  app.post("/api/users", async (req, res) => {
    const { username, password, role, name, email, pin } = req.body;
    try {
      // Check if PIN is provided and validate uniqueness
      if (pin) {
        if (!/^\d{5}$/.test(pin)) {
          return res.status(400).json({ message: "PIN must be 5 digits" });
        }
        // Check if PIN is already used by another user
        const existingUser = await db.select().from(users).where(eq(users.pin, pin)).limit(1);
        if (existingUser.length > 0) {
          return res.status(400).json({ message: "This PIN is used by other user" });
        }
        // Check if PIN is already used by a worker
        const existingWorker = await db.select().from(packingWorkers).where(eq(packingWorkers.pin, pin)).limit(1);
        if (existingWorker.length > 0) {
          return res.status(400).json({ message: "This PIN is used by other user" });
        }
      }
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password,
          role: role || "counter",
          name,
          email: email || null,
          pin: pin || "12345",
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
    const { username, password, role, name, email, active, pin } = req.body;
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    // Check if PIN is provided and validate uniqueness
    if (pin) {
      if (!/^\d{5}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 5 digits" });
      }
      
      // Get current user to check if PIN is actually changing
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const pinIsChanging = !currentUser || currentUser.pin !== pin;
      
      if (pinIsChanging) {
        // Check if PIN is already used by another user (excluding current user)
        const existingUser = await db.select().from(users).where(and(eq(users.pin, pin), ne(users.id, userId))).limit(1);
        if (existingUser.length > 0) {
          return res.status(400).json({ message: "This PIN is used by other user" });
        }
        // Check if PIN is already used by a worker (must use bcrypt compare since worker PINs are hashed)
        const allWorkers = await db.select().from(packingWorkers);
        for (const worker of allWorkers) {
          if (worker.pin && await bcrypt.compare(pin, worker.pin)) {
            return res.status(400).json({ message: "This PIN is used by other user" });
          }
        }
      }
    }
    
    // Get current user to check if name is changing
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const oldName = currentUser?.name;
    const oldUsername = currentUser?.username;
    
    const updates: any = {};
    if (username) updates.username = username;
    if (password) updates.password = password;
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email || null;
    if (active !== undefined) updates.active = active;
    if (pin) updates.pin = pin;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // If name changed, update all historical records with the new name
    if (name && oldName && name !== oldName) {
      // Update bills
      await db.update(bills).set({ createdBy: name }).where(eq(bills.createdBy, oldName));
      // Update orders - all name fields
      await db.update(orders).set({ entryBy: name }).where(eq(orders.entryBy, oldName));
      await db.update(orders).set({ tagBy: name }).where(eq(orders.tagBy, oldName));
      await db.update(orders).set({ packingBy: name }).where(eq(orders.packingBy, oldName));
      await db.update(orders).set({ deliveryBy: name }).where(eq(orders.deliveryBy, oldName));
      console.log(`Updated historical records from "${oldName}" to "${name}"`);
    }
    // Also update if username was used as name field (fallback)
    if (name && oldUsername && name !== oldUsername) {
      await db.update(bills).set({ createdBy: name }).where(eq(bills.createdBy, oldUsername));
      await db.update(orders).set({ entryBy: name }).where(eq(orders.entryBy, oldUsername));
      await db.update(orders).set({ tagBy: name }).where(eq(orders.tagBy, oldUsername));
      await db.update(orders).set({ packingBy: name }).where(eq(orders.packingBy, oldUsername));
      await db.update(orders).set({ deliveryBy: name }).where(eq(orders.deliveryBy, oldUsername));
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

  // Staff members routes - people assigned to shared role accounts
  app.get("/api/staff-members", async (req, res) => {
    const roleType = req.query.roleType as string | undefined;
    const members = await storage.getStaffMembers(roleType);
    res.json(members);
  });

  app.get("/api/staff-members/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid staff member ID" });
    }
    const member = await storage.getStaffMember(id);
    if (!member) {
      return res.status(404).json({ message: "Staff member not found" });
    }
    res.json(member);
  });

  app.post("/api/staff-members", async (req, res) => {
    const { name, pin, roleType } = req.body;
    try {
      if (!name || !pin || !roleType) {
        return res.status(400).json({ message: "Name, PIN, and roleType are required" });
      }
      if (!/^\d{5}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 5 digits" });
      }
      // Check if PIN is already used by another staff member (including inactive)
      const pinExists = await storage.checkStaffMemberPinExists(pin);
      if (pinExists) {
        return res.status(400).json({ message: "This PIN is already used by another staff member" });
      }
      // Check if PIN is already used by a user
      const existingUser = await db.select().from(users).where(eq(users.pin, pin)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "This PIN is already used by a user account" });
      }
      const member = await storage.createStaffMember({ name, pin, roleType });
      res.status(201).json(member);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create staff member" });
    }
  });

  app.put("/api/staff-members/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid staff member ID" });
    }
    const { name, pin, active } = req.body;
    try {
      if (pin && !/^\d{5}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 5 digits" });
      }
      // Check if PIN is already used by another staff member (if changing)
      if (pin) {
        const pinExists = await storage.checkStaffMemberPinExists(pin, id);
        if (pinExists) {
          return res.status(400).json({ message: "This PIN is already used by another staff member" });
        }
        const existingUser = await db.select().from(users).where(eq(users.pin, pin)).limit(1);
        if (existingUser.length > 0) {
          return res.status(400).json({ message: "This PIN is already used by a user account" });
        }
      }
      // Get current staff member to check if name is changing
      const currentMember = await storage.getStaffMember(id);
      const oldName = currentMember?.name;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (pin !== undefined) updates.pin = pin;
      if (active !== undefined) updates.active = active;
      const member = await storage.updateStaffMember(id, updates);
      
      // If name changed, update all historical records with the new name
      if (name && oldName && name !== oldName) {
        // Update bills
        await db.update(bills).set({ createdBy: name }).where(eq(bills.createdBy, oldName));
        // Update orders - all name fields
        await db.update(orders).set({ entryBy: name }).where(eq(orders.entryBy, oldName));
        await db.update(orders).set({ tagBy: name }).where(eq(orders.tagBy, oldName));
        await db.update(orders).set({ packingBy: name }).where(eq(orders.packingBy, oldName));
        await db.update(orders).set({ deliveryBy: name }).where(eq(orders.deliveryBy, oldName));
        console.log(`Updated historical records from "${oldName}" to "${name}"`);
      }
      
      res.json(member);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update staff member" });
    }
  });

  app.delete("/api/staff-members/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid staff member ID" });
    }
    await storage.deleteStaffMember(id);
    res.status(204).send();
  });

  // Verify staff member PIN (for billing/tracking identification)
  app.post("/api/staff-members/verify-pin", async (req, res) => {
    const { pin } = req.body;
    
    // First check user PINs (admin, counter, section, driver accounts)
    const user = await storage.verifyUserPin(pin);
    if (user) {
      return res.json({ success: true, member: { id: user.id, name: user.name || user.username, roleType: user.role } });
    }
    
    // Then check staff member PINs
    const member = await storage.verifyStaffMemberPin(pin);
    if (member) {
      return res.json({ success: true, member: { id: member.id, name: member.name, roleType: member.roleType } });
    }
    
    // Check packing workers (legacy)
    const packingWorker = await storage.verifyPackingWorkerPin(pin);
    if (packingWorker) {
      return res.json({ success: true, member: { id: packingWorker.id, name: packingWorker.name, roleType: "section" } });
    }
    
    // Check delivery workers (legacy)
    const deliveryWorker = await storage.verifyDeliveryWorkerPin(pin);
    if (deliveryWorker) {
      return res.json({ success: true, member: { id: deliveryWorker.id, name: deliveryWorker.name, roleType: "driver" } });
    }
    
    res.status(401).json({ success: false, message: "Invalid PIN" });
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

      if (input.name) input.name = input.name.trim().toUpperCase();
      if (input.address) input.address = input.address.trim().toUpperCase();

      // Check if phone number already exists (phone must be unique)
      if (input.phone) {
        const existingClientByPhone = await storage.findClientByPhone(input.phone);
        if (existingClientByPhone) {
          return res.status(409).json({
            message: `This phone number already exists in the system`,
            field: "phone",
            existingClient: {
              id: existingClientByPhone.id,
              name: existingClientByPhone.name,
              phone: existingClientByPhone.phone,
              address: existingClientByPhone.address,
            },
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

      if (input.name) input.name = input.name.trim().toUpperCase();
      if (input.address) input.address = input.address.trim().toUpperCase();

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
    
    // Check if client has any unpaid bills
    const clientBills = await storage.getClientBills(clientId);
    const unpaidBills = clientBills.filter(b => !b.isPaid);
    if (unpaidBills.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete client: has ${unpaidBills.length} unpaid bill(s). Please collect payment first.` 
      });
    }
    
    // Check client balance
    const client = await storage.getClient(clientId);
    if (client && parseFloat(client.balance || "0") !== 0) {
      return res.status(400).json({ 
        message: `Cannot delete client: has outstanding balance of ${client.balance} AED. Please settle the balance first.` 
      });
    }
    
    // Delete all transaction history first
    const transactions = await storage.getClientTransactions(clientId);
    if (transactions.length > 0) {
      await storage.clearClientTransactions(clientId);
    }
    
    await storage.deleteClient(clientId);
    res.status(204).send();
  });
  
  // Delete client with admin password verification
  app.post("/api/clients/:id/delete-with-password", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Admin password required" });
    }
    
    // Verify admin password
    const adminUser = await storage.getUserByUsername("admin");
    if (!adminUser || adminUser.password !== password) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    // Check if client has any unpaid bills
    const clientBills = await storage.getClientBills(clientId);
    const unpaidBills = clientBills.filter(b => !b.isPaid);
    if (unpaidBills.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete client: has ${unpaidBills.length} unpaid bill(s). Please collect payment first.` 
      });
    }
    
    // Check client balance
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    if (parseFloat(client.balance || "0") !== 0) {
      return res.status(400).json({ 
        message: `Cannot delete client: has outstanding balance of ${client.balance} AED. Please settle the balance first.` 
      });
    }
    
    // Delete all transaction history first
    const transactions = await storage.getClientTransactions(clientId);
    if (transactions.length > 0) {
      await storage.clearClientTransactions(clientId);
    }
    
    await storage.deleteClient(clientId);
    res.json({ message: "Client deleted successfully" });
  });

  // Clear client transaction history (requires admin password)
  app.post("/api/clients/:id/clear-transactions", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Admin password required" });
    }
    
    // Verify admin password
    const adminUser = await storage.getUserByUsername("admin");
    if (!adminUser || adminUser.password !== password) {
      return res.status(403).json({ message: "Invalid admin password" });
    }
    
    // Check if client exists
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    // Check if client has any unpaid bills
    const clientBills = await storage.getClientBills(clientId);
    const unpaidBills = clientBills.filter(b => !b.isPaid);
    if (unpaidBills.length > 0) {
      return res.status(400).json({ 
        message: `Cannot clear history: client has ${unpaidBills.length} unpaid bill(s)` 
      });
    }
    
    // Check if client has outstanding balance
    if (parseFloat(client.balance || "0") !== 0) {
      return res.status(400).json({ 
        message: `Cannot clear history: client has outstanding balance of ${client.balance} AED` 
      });
    }
    
    await storage.clearClientTransactions(clientId);
    res.status(200).json({ message: "Transaction history cleared successfully" });
  });

  // Product routes
  app.get(api.products.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const products = await storage.getProducts(search);
    res.json(products);
  });

  app.get("/api/products/allocated-stock", async (req, res) => {
    try {
      const allocatedStock = await storage.getAllocatedStock();
      res.json(allocatedStock);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products/orders-by-product", async (req, res) => {
    try {
      const productName = req.query.name as string;
      if (!productName) {
        return res.status(400).json({ message: "Product name is required" });
      }
      const ordersList = await storage.getOrdersForProduct(productName);
      res.json(ordersList);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
      const numericFields = ['price', 'dryCleanPrice', 'ironOnlyPrice', 'smallPrice', 'mediumPrice', 'largePrice', 'sqmPrice'];
      const sanitized = { ...req.body };
      for (const field of numericFields) {
        if (sanitized[field] === '' || sanitized[field] === undefined) {
          sanitized[field] = null;
        }
      }
      const input = api.products.create.input.parse(sanitized);
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
      const numericFields = ['price', 'dryCleanPrice', 'ironOnlyPrice', 'smallPrice', 'mediumPrice', 'largePrice', 'sqmPrice'];
      const sanitized = { ...req.body };
      for (const field of numericFields) {
        if (sanitized[field] === '') {
          sanitized[field] = null;
        } else if (sanitized[field] === undefined) {
          delete sanitized[field];
        }
      }
      const input = api.products.update.input.parse(sanitized);
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
  app.get("/api/bill-payments", async (req, res) => {
    const payments = await storage.getAllBillPayments();
    res.json(payments);
  });

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
      const { amount, paymentMethod, notes, processedBy } = req.body;
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
        processedBy,
      );
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Pay all unpaid bills for a client
  app.post("/api/clients/:id/pay-all-bills", async (req, res) => {
    try {
      const clientId = Number(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      
      const { amount, paymentMethod, notes } = req.body;
      const paymentAmount = parseFloat(amount);
      
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: "Valid payment amount is required" });
      }
      
      // For deposit payments, check if client has enough credit
      if (paymentMethod === "deposit") {
        const client = await storage.getClient(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }
        const currentDeposit = parseFloat(client.deposit || "0");
        if (currentDeposit < paymentAmount) {
          return res.status(400).json({ 
            message: `Insufficient credit balance. Available: ${currentDeposit.toFixed(2)} AED, Required: ${paymentAmount.toFixed(2)} AED` 
          });
        }
      }
      
      // Get all unpaid bills for this client
      const bills = await storage.getBills();
      const clientUnpaidBills = bills
        .filter(b => {
          if (b.clientId !== clientId) return false;
          const amt = parseFloat(b.amount || "0");
          const paid = parseFloat(b.paidAmount || "0");
          return amt - paid > 0.01;
        })
        .sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime()); // oldest first
      
      if (clientUnpaidBills.length === 0) {
        return res.status(400).json({ message: "No unpaid bills found for this client" });
      }
      
      let remainingPayment = paymentAmount;
      const paidBills: any[] = [];
      
      // For deposit payments, we need to handle the deposit deduction ourselves
      // and pass a different method to payBill to avoid individual deposit_used transactions
      const billPaymentMethod = paymentMethod === "deposit" ? "bulk_deposit" : paymentMethod;
      
      // Distribute payment across bills, starting with oldest
      for (const bill of clientUnpaidBills) {
        if (remainingPayment <= 0) break;
        
        const billAmount = parseFloat(bill.amount || "0");
        const billPaid = parseFloat(bill.paidAmount || "0");
        const billDue = billAmount - billPaid;
        
        const payForThisBill = Math.min(remainingPayment, billDue);
        
        if (payForThisBill > 0) {
          const result = await storage.payBill(
            bill.id,
            payForThisBill.toString(),
            billPaymentMethod, // Use bulk_deposit to avoid individual deposit handling
            notes || `Bulk payment for client`,
            undefined, // processedBy
            true // skipTransaction - we'll create a single bulk_payment transaction
          );
          paidBills.push({ billId: bill.id, amountPaid: payForThisBill, result });
          remainingPayment -= payForThisBill;
        }
      }
      
      // Handle deposit deduction for bulk deposit payments
      if (paymentMethod === "deposit" && paidBills.length > 0) {
        const client = await storage.getClient(clientId);
        if (client) {
          const currentDeposit = parseFloat(client.deposit || "0");
          const currentAmount = parseFloat(client.amount || "0");
          const newDeposit = Math.max(0, currentDeposit - paymentAmount);
          const newBalance = currentAmount - newDeposit;
          
          await storage.updateClient(clientId, {
            deposit: newDeposit.toFixed(2),
            balance: newBalance.toFixed(2),
          });
        }
      }
      
      // Create a single bulk_payment transaction for the entire payment
      if (paidBills.length > 0) {
        const billIds = paidBills.map(b => `#${b.billId}`).join(", ");
        const transactionType = paymentMethod === "deposit" ? "bulk_deposit_used" : "bulk_payment";
        const client = await storage.getClient(clientId);
        const newBalance = client ? parseFloat(client.balance || "0") : 0;
        
        await storage.createTransaction({
          clientId: clientId,
          type: transactionType,
          amount: paymentAmount.toFixed(2),
          description: notes || `Bulk payment applied to ${paidBills.length} bills (${billIds})`,
          date: new Date(),
          runningBalance: paymentMethod === "deposit" ? newBalance.toFixed(2) : "0",
          paymentMethod: paymentMethod || "cash",
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: `Payment of ${paymentAmount.toFixed(2)} AED applied to ${paidBills.length} bills`,
        paidBills,
        remainingAmount: remainingPayment > 0.01 ? remainingPayment : 0
      });
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
      const { amount, description, paymentMethod } = req.body;
      const clientId = Number(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const transaction = await storage.addClientDeposit(
        clientId,
        amount,
        description,
        paymentMethod || "cash",
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

  // Active Orders for Incident Reporting (with client info)
  app.get("/api/orders/active-with-clients", async (req, res) => {
    try {
      const allOrders = await storage.getOrders();
      // Include "entry" status as well (shows as "Pending" in UI)
      const activeStatuses = ["entry", "pending", "tagging", "packing", "ready"];
      const activeOrders = allOrders.filter(o => activeStatuses.includes(o.status || "") && !o.delivered);
      
      // Get client info for each order
      const ordersWithClients = await Promise.all(
        activeOrders.map(async (order) => {
          let clientInfo = { name: order.customerName, phone: "", address: "" };
          if (order.clientId) {
            const client = await storage.getClient(order.clientId);
            if (client) {
              clientInfo = {
                name: client.name,
                phone: client.phone || "",
                address: client.address || "",
              };
            }
          }
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            customerName: clientInfo.name,
            customerPhone: clientInfo.phone,
            customerAddress: clientInfo.address,
            items: order.items || "",
            totalAmount: order.totalAmount || "0",
          };
        })
      );
      
      res.json(ordersWithClients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active orders" });
    }
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
        createdBy,
        creatorRole,
      } = req.body;

      if (customerName) customerName = customerName.trim().toUpperCase();
      if (deliveryAddress) deliveryAddress = deliveryAddress.trim().toUpperCase();
      
      // All PINs are universal - any valid PIN can create orders
      // createdBy and creatorRole are used for tracking only, not for access control

      // // Validate required fields
      // if (!customerName || !customerName.trim()) {
      //   return res.status(400).json({ message: "Customer name is required" });
      // }
      // if (!customerPhone || !customerPhone.trim()) {
      //   return res.status(400).json({ message: "Customer phone is required" });
      // }

      // Check if customer already exists - if so, reject and require using the existing client
      let clientId = req.body.clientId;

      if (!clientId) {
        // For walk-in orders, check if phone matches existing client - if so, reject
        if (customerPhone && customerPhone.trim()) {
          const allClients = await storage.getClients();
          const normalizedInputPhone = customerPhone.replace(/\D/g, '').replace(/^(00971|971|\+971|0)/, '');
          const existingClient = allClients.find(client => {
            const clientPhone = (client.phone || '').replace(/\D/g, '').replace(/^(00971|971|\+971|0)/, '');
            return clientPhone && normalizedInputPhone && clientPhone === normalizedInputPhone && normalizedInputPhone.length >= 7;
          });
          
          if (existingClient) {
            // Block creation - client already exists
            return res
              .status(400)
              .json({ message: `Customer details already exist: ${existingClient.name}. Please select them from the client list.` });
          }
        }
        
        // No matching client found - create new one
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
            createdBy: createdBy || undefined,
          });
          assignedBillId = newBill.id;
        } else {
          // Default behavior: always create a new bill for each order
          // Each order gets its own separate bill for independent payment tracking
          const newBill = await storage.createBill({
            clientId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            amount: orderAmount.toFixed(2),
            description: `Order #${order.orderNumber}: ${order.items || "Items"}`,
            billDate: new Date(),
            referenceNumber: `BILL-${order.orderNumber}`,
            createdBy: createdBy || undefined,
          });
          assignedBillId = newBill.id;
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
      
      const updates = { ...req.body };
      
      // If packingDone is being set to true, record the packing completion time
      if (updates.packingDone === true) {
        const existingOrder = await storage.getOrder(orderId);
        if (existingOrder && !existingOrder.packingDone) {
          updates.packingDate = new Date().toISOString();
        }
      }
      
      const order = await storage.updateOrder(orderId, updates);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update order items and recalculate bill
  app.post("/api/orders/:id/update-items", async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      
      const { items, staffPin, staffName } = req.body;
      if (!items || !staffPin) {
        return res.status(400).json({ message: "Items and staff PIN are required" });
      }
      
      // Verify PIN - accept admin PIN, user PINs, or packing worker PINs
      const ADMIN_PIN = "00000";
      let verifiedUser: string | null = null;
      
      if (staffPin === ADMIN_PIN) {
        verifiedUser = "Admin";
      } else {
        // Check user PINs
        const users = await storage.getUsers();
        const user = users.find((u: any) => u.pin === staffPin);
        if (user) {
          verifiedUser = user.displayName || user.username;
        } else {
          // Check packing worker PINs
          const packingWorkers = await storage.getPackingWorkers();
          const worker = packingWorkers.find((w: any) => w.pin === staffPin);
          if (worker) {
            verifiedUser = worker.name;
          }
        }
      }
      
      if (!verifiedUser) {
        return res.status(401).json({ message: "Invalid staff PIN" });
      }
      
      // Get current order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Calculate new total from items
      const allProducts = await storage.getProducts();
      let newTotal = 0;
      const itemsArray: string[] = [];
      
      for (const item of items) {
        // Parse item name to extract base product name and service type
        // Format can be: "ProductName [N] (folding)", "ProductName [D] (hanger)", or "ProductName (Size) @ price AED"
        let itemName = item.name;
        let isDryClean = false;
        let customPrice: number | null = null;
        
        // Check for custom price format: "ProductName (Size) @ price AED"
        const customPriceMatch = itemName.match(/(.+?)\s*@\s*([\d.]+)\s*AED/i);
        if (customPriceMatch) {
          const baseName = customPriceMatch[1].trim();
          customPrice = parseFloat(customPriceMatch[2]);
          newTotal += customPrice * item.quantity;
          itemsArray.push(`${item.quantity}x ${item.name}`);
          continue;
        }
        
        // Check for service type [N] or [D]
        if (itemName.includes('[D]')) {
          isDryClean = true;
        }
        
        // Extract base product name by removing service indicator and packaging type
        let baseProductName = itemName
          .replace(/\s*\[N\]\s*/g, '')
          .replace(/\s*\[D\]\s*/g, '')
          .replace(/\s*\(folding\)\s*/gi, '')
          .replace(/\s*\(hanger\)\s*/gi, '')
          .trim();
        
        const product = allProducts.find((p: any) => p.name.toLowerCase() === baseProductName.toLowerCase());
        if (product) {
          // Use dry clean price if [D] service type, otherwise normal price
          const price = isDryClean 
            ? parseFloat(product.dryCleanPrice || product.price || "0")
            : parseFloat(product.price || "0");
          newTotal += price * item.quantity;
          itemsArray.push(`${item.quantity}x ${item.name}`);
        } else {
          // Custom item - try to find price from original order items
          itemsArray.push(`${item.quantity}x ${item.name}`);
          // Look for price in original items - keep the item but price stays 0 if not found
        }
      }
      
      const newItemsText = itemsArray.join(", ");
      
      // Check if urgent - multiply by 2
      const isUrgent = order.urgent === true;
      const subtotal = isUrgent ? newTotal * 2 : newTotal;
      
      // Apply discount if any
      const discountPercent = parseFloat(order.discountPercent || "0");
      const discountAmount = (subtotal * discountPercent) / 100;
      const tips = parseFloat(order.tips || "0");
      const finalAmount = subtotal - discountAmount + tips;
      
      // Calculate the difference in order amount
      const oldFinalAmount = parseFloat(order.finalAmount || order.totalAmount || "0");
      const amountDifference = finalAmount - oldFinalAmount;
      
      // Update order
      const updatedOrder = await storage.updateOrder(orderId, {
        items: newItemsText,
        totalAmount: newTotal.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        notes: `${order.notes || ""}\n[${new Date().toLocaleString()}] Items updated by ${verifiedUser}. Amount changed from AED ${oldFinalAmount.toFixed(2)} to AED ${finalAmount.toFixed(2)}`,
      });
      
      let billUpdated = false;
      let newDueAmount = 0;
      
      // Update associated bill if exists
      if (order.billId) {
        const bill = await storage.getBill(order.billId);
        if (bill) {
          // Recalculate bill total from all orders in this bill
          const billOrders = await storage.getOrders();
          const ordersInBill = billOrders.filter((o: any) => o.billId === order.billId);
          
          let billTotal = 0;
          for (const billOrder of ordersInBill) {
            if (billOrder.id === orderId) {
              billTotal += finalAmount;
            } else {
              billTotal += parseFloat(billOrder.finalAmount || billOrder.totalAmount || "0");
            }
          }
          
          // Check if bill was paid - if so, any added amount goes to due
          const previousBillAmount = parseFloat(bill.amount || "0");
          const previousPaidAmount = parseFloat(bill.paidAmount || "0");
          const previousDue = previousBillAmount - previousPaidAmount;
          const wasPreviouslyPaid = bill.isPaid || previousPaidAmount >= previousBillAmount;
          
          // Calculate new due: new bill total - what was already paid
          newDueAmount = billTotal - previousPaidAmount;
          const isNowPaid = newDueAmount <= 0;
          
          // Update the bill with new amount
          // Keep paidAmount as is - it shows what was already paid
          // The due amount is calculated as: amount - paidAmount
          
          // Build history note if items were added to a paid bill
          let updatedNotes = bill.notes || "";
          if (wasPreviouslyPaid && !isNowPaid && amountDifference > 0) {
            const historyEntry = `\n[${new Date().toLocaleString()}] ITEM RECOUNT: Original bill ${previousBillAmount.toFixed(2)} AED (PAID). Added items worth ${amountDifference.toFixed(2)} AED. New total: ${billTotal.toFixed(2)} AED. Amount due: ${newDueAmount.toFixed(2)} AED`;
            updatedNotes += historyEntry;
            console.log(`Bill #${order.billId} was fully paid (${previousPaidAmount} AED) but now has additional due of ${newDueAmount.toFixed(2)} AED after item recount`);
          } else if (amountDifference !== 0) {
            const historyEntry = `\n[${new Date().toLocaleString()}] Items updated: Amount changed from ${previousBillAmount.toFixed(2)} to ${billTotal.toFixed(2)} AED`;
            updatedNotes += historyEntry;
          }
          
          await storage.updateBill(order.billId, {
            amount: billTotal.toFixed(2),
            isPaid: isNowPaid,
            description: `Order #${order.orderNumber}: ${newItemsText}`,
            notes: updatedNotes.trim(),
          });
          billUpdated = true;
        }
      }
      
      res.json({ 
        order: updatedOrder, 
        message: billUpdated && amountDifference > 0 
          ? `Items updated. AED ${amountDifference.toFixed(2)} added to due amount.`
          : billUpdated && amountDifference < 0
          ? `Items updated. AED ${Math.abs(amountDifference).toFixed(2)} reduced from bill.`
          : "Items updated successfully",
        updatedBy: verifiedUser,
        amountDifference: amountDifference.toFixed(2),
        newDueAmount: newDueAmount.toFixed(2),
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    // Deduct stock before deleting
    await storage.deductStockForOrder(orderId);
    // Delete linked bill, revert payments/credits, and clean up transactions
    if (order.billId) {
      try {
        const bill = await storage.getBill(order.billId);
        if (bill && bill.clientId) {
          const paidAmount = parseFloat(bill.paidAmount || "0");
          
          if (paidAmount > 0) {
            // Check bill payments to find if any were paid by deposit/credit
            const payments = await db.select().from(billPayments).where(eq(billPayments.billId, order.billId));
            let depositPaid = 0;
            for (const p of payments) {
              if (p.paymentMethod === "deposit" || p.paymentMethod === "bulk_deposit") {
                depositPaid += parseFloat(p.amount || "0");
              }
            }
            
            // Also check client transactions for deposit_used entries referencing this bill
            const txns = await db.select().from(clientTransactions).where(eq(clientTransactions.clientId, bill.clientId));
            for (const tx of txns) {
              if ((tx.type === "deposit_used" || tx.type === "bulk_deposit_used") && 
                  tx.description?.includes(`Bill #${order.billId}`)) {
                depositPaid = Math.max(depositPaid, parseFloat(tx.amount || "0"));
              }
            }
            
            // Revert credit/deposit back to client if paid by deposit
            if (depositPaid > 0) {
              const client = await storage.getClient(bill.clientId);
              if (client) {
                const currentDeposit = parseFloat(client.deposit || "0");
                const newDeposit = currentDeposit + depositPaid;
                const currentAmount = parseFloat(client.amount || "0");
                const newBalance = currentAmount - newDeposit;
                await storage.updateClient(bill.clientId, {
                  deposit: newDeposit.toFixed(2),
                  balance: newBalance.toFixed(2),
                });
              }
            }
          }
          
          // Delete all transactions that reference this bill (payment, deposit_used, etc.)
          const allTxns = await db.select().from(clientTransactions).where(eq(clientTransactions.clientId, bill.clientId));
          for (const tx of allTxns) {
            if (tx.billId === order.billId || 
                tx.description?.includes(`Bill #${order.billId}:`) ||
                tx.description?.includes(`Bill #${order.billId} `)) {
              await db.delete(clientTransactions).where(eq(clientTransactions.id, tx.id));
            }
          }
        }
        
        // Delete bill payments
        await db.delete(billPayments).where(eq(billPayments.billId, order.billId));
        // Delete the bill
        await storage.deleteBill(order.billId);
      } catch (err) {
        console.error("[DELETE ORDER] Error cleaning up bill/transactions:", err);
      }
    }
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

  // Reset all incidents (admin password protected)
  app.post("/api/incidents/reset-all", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      await storage.deleteAllIncidents();
      res.json({ success: true, message: "All incidents have been reset" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset incidents: " + err.message });
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
      await storage.deleteAllIncidents(); // This clears all incidents
      
      // Reset users to defaults (keeping admin, adding default staff)
      await storage.resetUsersToDefaults();
      
      // Reset packing workers to defaults
      await storage.resetPackingWorkersToDefaults();
      
      res.json({ success: true, message: "All data has been reset successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset all data: " + err.message });
    }
  });

  // Reset users only (admin password protected)
  app.post("/api/admin/reset-users", async (req, res) => {
    const { adminPassword } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin password" });
    }
    
    try {
      // Reset users to defaults (keeping admin, adding default staff)
      await storage.resetUsersToDefaults();
      
      // Reset packing workers to defaults (clears all)
      await storage.resetPackingWorkersToDefaults();
      
      res.json({ success: true, message: "Users have been reset to defaults" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reset users: " + err.message });
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

  // Store for admin OTPs (in production, use database or Redis)
  const adminOtpStore: { otp: string; expiresAt: Date } | null = { otp: "", expiresAt: new Date(0) };

  // Get admin account settings
  app.get("/api/admin/account", async (req, res) => {
    const adminUser = await storage.getUserByUsername("admin");
    
    // Get values from database user first, fallback to env vars
    const adminUsername = adminUser?.username || process.env.ADMIN_USERNAME || "admin";
    const adminEmail = adminUser?.email || process.env.ADMIN_EMAIL || "idusma0010@gmail.com";
    const adminPassword = adminUser?.password || process.env.ADMIN_PASSWORD || "admin123";
    const adminPin = adminUser?.pin || process.env.ADMIN_PIN || "";
    
    res.json({
      username: adminUsername,
      email: adminEmail,
      password: adminPassword,
      pin: adminPin,
      hasPin: !!adminPin
    });
  });

  // Update admin account settings (username, email, PIN - requires current password)
  app.put("/api/admin/account", async (req, res) => {
    const { currentPassword, username, email, pin } = req.body;
    
    // Get admin user from database to verify password
    const adminUser = await storage.getUserByUsername("admin");
    const ADMIN_PASSWORD = adminUser?.password || process.env.ADMIN_PASSWORD || "admin123";
    
    if (!currentPassword || currentPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }
    
    try {
      if (adminUser) {
        // Update admin user in database
        const updates: any = {};
        if (email) updates.email = email;
        if (pin !== undefined && pin !== null && pin !== "") {
          // Validate PIN is 5 digits if provided
          if (!/^\d{5}$/.test(pin)) {
            return res.status(400).json({ success: false, message: "PIN must be exactly 5 digits" });
          }
          updates.pin = pin;
        }
        
        await storage.updateUser(adminUser.id, updates);
      }
      
      res.json({
        success: true,
        message: "Admin settings updated successfully.",
        settings: { username, email, hasPin: !!pin }
      });
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ success: false, message: "Failed to update admin settings" });
    }
  });

  // Send OTP to admin email for password change
  app.post("/api/admin/send-password-otp", async (req, res) => {
    const adminUser = await storage.getUserByUsername("admin");
    const adminEmail = adminUser?.email || process.env.ADMIN_EMAIL || "idusma0010@gmail.com";
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    
    // Store OTP
    adminOtpStore.otp = otp;
    adminOtpStore.expiresAt = expiresAt;
    
    try {
      // Send OTP via SMTP
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: adminEmail,
        subject: "Liquid Washes - Admin Password Reset OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Password Reset Request</h2>
            <p>Your OTP code for resetting the admin password is:</p>
            <div style="background: #f0f9ff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
      
      res.json({
        success: true,
        message: `OTP sent to ${adminEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3")}`,
      });
    } catch (error: any) {
      console.error("Failed to send OTP:", error);
      res.status(500).json({ success: false, message: "Failed to send OTP email" });
    }
  });

  // Verify OTP and change admin password
  app.post("/api/admin/change-password-with-otp", async (req, res) => {
    const { otp, newPassword } = req.body;
    
    if (!otp || !newPassword) {
      return res.status(400).json({ success: false, message: "OTP and new password are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    
    // Verify OTP
    if (!adminOtpStore.otp || adminOtpStore.otp !== otp) {
      return res.status(401).json({ success: false, message: "Invalid OTP" });
    }
    
    if (new Date() > adminOtpStore.expiresAt) {
      return res.status(401).json({ success: false, message: "OTP has expired" });
    }
    
    // Clear OTP after use
    adminOtpStore.otp = "";
    adminOtpStore.expiresAt = new Date(0);
    
    try {
      // Update admin password in database
      const adminUser = await storage.getUserByUsername("admin");
      if (adminUser) {
        await storage.updateUser(adminUser.id, { password: newPassword });
      } else {
        // Create admin user if doesn't exist
        await storage.createUser({
          username: "admin",
          password: newPassword,
          role: "admin",
          email: process.env.ADMIN_EMAIL || "idusma0010@gmail.com"
        });
      }
      
      res.json({
        success: true,
        message: "Password changed successfully!",
      });
    } catch (error: any) {
      console.error("Failed to update password:", error);
      res.status(500).json({ success: false, message: "Failed to update password" });
    }
  });

  // Get admin email dynamically from database for reports
  async function getAdminReportEmail(): Promise<string> {
    try {
      const adminUser = await storage.getUserByUsername("admin");
      return adminUser?.email || process.env.ADMIN_REPORT_EMAIL || "idusma0010@gmail.com";
    } catch {
      return process.env.ADMIN_REPORT_EMAIL || "idusma0010@gmail.com";
    }
  }

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
      const itemsMatch = (order.items || '').match(/(\d+)x\s+([^,()]+)/g);
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
    
    const orderDetails = todaysOrders.map(order => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName || 'Walk-in',
      amount: order.finalAmount || order.totalAmount,
      entryBy: order.entryBy,
      tagBy: order.tagBy,
      packingBy: order.packingBy,
      deliveryBy: order.deliveryBy,
      status: order.delivered ? 'Delivered' : order.packingDone ? 'Packed' : order.tagDone ? 'Tagged' : 'Entry'
    }));
    
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
      topItems,
      orderDetails
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
      const adminEmail = await getAdminReportEmail();
      await sendDailySalesReportEmailSMTP(adminEmail, salesData);
      
      res.json({ 
        success: true, 
        message: `Daily sales report sent to ${adminEmail}`,
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

  // Get admin report email setting (dynamic from database)
  app.get("/api/admin/report-email", async (req, res) => {
    const email = await getAdminReportEmail();
    res.json({ email });
  });

  // Generate sales data for a date range
  async function generateSalesReportData(startDate: Date, endDate: Date, period: ReportPeriod): Promise<SalesReportData> {
    const orders = await storage.getOrders();
    
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.entryDate);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.finalAmount || "0"), 0);
    const paidAmount = filteredOrders.reduce((sum, o) => sum + parseFloat(o.paidAmount || "0"), 0);
    const pendingAmount = totalRevenue - paidAmount;
    const normalOrders = filteredOrders.filter(o => !o.urgent).length;
    const urgentOrders = filteredOrders.filter(o => o.urgent).length;
    const pickupOrders = filteredOrders.filter(o => o.deliveryType === "pickup").length;
    const deliveryOrders = filteredOrders.filter(o => o.deliveryType === "delivery").length;
    
    const itemCounts: Record<string, number> = {};
    filteredOrders.forEach(order => {
      const itemsMatch = (order.items || '').match(/(\d+)x\s+([^,()]+)/g);
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
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    let dateRange = '';
    if (period === 'daily') {
      dateRange = formatDate(startDate);
    } else if (period === 'yearly') {
      dateRange = `Year ${startDate.getFullYear()}`;
    } else {
      dateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    
    return {
      period,
      dateRange,
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

  // Send periodic sales report (admin protected)
  app.post("/api/admin/send-report", async (req, res) => {
    const { adminPassword, period } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }
    
    const validPeriods: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!period || !validPeriods.includes(period)) {
      return res.status(400).json({ success: false, message: "Invalid period. Must be daily, weekly, monthly, or yearly." });
    }
    
    try {
      const now = new Date();
      let startDate: Date = new Date(now);
      let endDate: Date = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      const reportPeriod = period as ReportPeriod;
      
      switch (reportPeriod) {
        case 'daily':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }
      
      const salesData = await generateSalesReportData(startDate, endDate, reportPeriod);
      const adminEmail = await getAdminReportEmail();
      await sendSalesReportEmailSMTP(adminEmail, salesData);
      
      const periodLabels: Record<ReportPeriod, string> = {
        daily: 'Daily',
        weekly: 'Weekly', 
        monthly: 'Monthly',
        yearly: 'Yearly'
      };
      
      res.json({ 
        success: true, 
        message: `${periodLabels[reportPeriod]} sales report sent to ${adminEmail}`,
        data: salesData
      });
    } catch (err: any) {
      console.error(`Failed to send ${period} report:`, err);
      res.status(500).json({ 
        success: false, 
        message: `Failed to send ${period} report: ` + err.message 
      });
    }
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
      // Check if PIN is already used by another worker (must use bcrypt compare since worker PINs are hashed)
      const allWorkers = await db.select().from(packingWorkers);
      for (const worker of allWorkers) {
        if (worker.pin && await bcrypt.compare(pin, worker.pin)) {
          return res.status(400).json({ message: "This PIN is used by other user" });
        }
      }
      // Check if PIN is already used by a user
      const existingUser = await db.select().from(users).where(eq(users.pin, pin)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "This PIN is used by other user" });
      }
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
      // Check if PIN is already used by another worker (excluding current worker)
      if (pin) {
        const allWorkers = await db.select().from(packingWorkers).where(ne(packingWorkers.id, workerId));
        for (const worker of allWorkers) {
          if (worker.pin && await bcrypt.compare(pin, worker.pin)) {
            return res.status(400).json({ message: "This PIN is used by other user" });
          }
        }
        // Check if PIN is already used by a user
        const existingUser = await db.select().from(users).where(eq(users.pin, pin)).limit(1);
        if (existingUser.length > 0) {
          return res.status(400).json({ message: "This PIN is used by other user" });
        }
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

  // Verify staff user PIN (for bill creation, etc.) - Admin PIN works as universal PIN
  // Only allows admin and reception roles - NOT packing staff
  app.post("/api/workers/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
    }
    
    // Check if it's the admin universal PIN (from database)
    const adminUser = await storage.getUserByUsername("admin");
    const adminPin = adminUser?.pin || process.env.ADMIN_PIN || "";
    if (adminPin && pin === adminPin) {
      return res.json({ success: true, worker: { id: adminUser?.id || 0, name: "Admin", role: "admin" } });
    }
    
    // All PINs are universal - any valid PIN can be used for any process
    const user = await storage.verifyUserPin(pin);
    if (user) {
      return res.json({ success: true, worker: { id: user.id, name: user.name || user.username, role: user.role } });
    }
    
    // Check staff members - all staff can use their PIN universally
    const staffMember = await storage.verifyStaffMemberPin(pin);
    if (staffMember) {
      return res.json({ success: true, worker: { id: staffMember.id, name: staffMember.name, role: staffMember.roleType } });
    }
    
    // Check packing workers (legacy)
    const packingWorker = await storage.verifyPackingWorkerPin(pin);
    if (packingWorker) {
      return res.json({ success: true, worker: { id: packingWorker.id, name: packingWorker.name, role: "section" } });
    }
    
    res.status(401).json({ success: false, message: "Invalid PIN" });
  });

  // Verify packing worker PIN - Admin PIN works as universal PIN
  app.post("/api/packing/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
    }
    
    // Check if it's the admin universal PIN (from database)
    const adminUser = await storage.getUserByUsername("admin");
    const adminPin = adminUser?.pin || process.env.ADMIN_PIN || "";
    if (adminPin && pin === adminPin) {
      return res.json({ success: true, worker: { id: adminUser?.id || null, name: "Admin", isUser: true } });
    }
    
    // Check for user PIN (admin, reception, staff roles)
    const user = await storage.verifyUserPin(pin);
    if (user) {
      return res.json({ success: true, worker: { id: user.id, name: user.name || user.username, isUser: true } });
    }
    
    // Check staff members (counter, section, driver staff)
    const staffMember = await storage.verifyStaffMemberPin(pin);
    if (staffMember) {
      return res.json({ success: true, worker: { id: staffMember.id, name: staffMember.name, isUser: false } });
    }
    
    // Also check packing workers (legacy)
    const worker = await storage.verifyPackingWorkerPin(pin);
    if (worker) {
      res.json({ success: true, worker: { id: worker.id, name: worker.name, isUser: false } });
    } else {
      res.status(401).json({ success: false, message: "Invalid PIN" });
    }
  });

  // Verify delivery staff PIN - Admin PIN works as universal PIN
  app.post("/api/delivery/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
    }
    
    // Check if it's the admin universal PIN (from database)
    const adminUser = await storage.getUserByUsername("admin");
    const adminPin = adminUser?.pin || process.env.ADMIN_PIN || "";
    if (adminPin && pin === adminPin) {
      return res.json({ success: true, worker: { id: adminUser?.id || null, name: "Admin", isUser: true } });
    }
    
    // Check for any user PIN (admin, reception, staff, driver roles can all verify delivery)
    const user = await storage.verifyUserPin(pin);
    if (user) {
      return res.json({ success: true, worker: { id: user.id, name: user.name || user.username, isUser: true } });
    }
    
    // Check staff members (counter, section, driver staff)
    const staffMember = await storage.verifyStaffMemberPin(pin);
    if (staffMember) {
      return res.json({ success: true, worker: { id: staffMember.id, name: staffMember.name, isUser: false } });
    }
    
    // Also allow packing workers for backward compatibility
    const worker = await storage.verifyDeliveryWorkerPin(pin);
    if (worker) {
      res.json({ success: true, worker: { id: worker.id, name: worker.name, isUser: false } });
    } else {
      res.status(401).json({ success: false, message: "Invalid Staff PIN" });
    }
  });

  // Verify any user PIN for incident recording - checks users, packing workers, staff members, and drivers
  app.post("/api/incidents/verify-pin", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{5}$/.test(pin)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PIN format" });
    }
    
    // Check if it's the admin universal PIN (from database)
    const adminUser = await storage.getUserByUsername("admin");
    const adminPin = adminUser?.pin || process.env.ADMIN_PIN || "";
    if (adminPin && pin === adminPin) {
      return res.json({ success: true, user: { id: adminUser?.id || 0, name: "Admin", type: "admin" } });
    }
    
    // Check for user PIN (admin, reception, staff roles)
    const user = await storage.verifyUserPin(pin);
    if (user) {
      return res.json({ success: true, user: { id: user.id, name: user.name || user.username, type: "user" } });
    }
    
    // Check staff members (counter, section, driver staff)
    const staffMember = await storage.verifyStaffMemberPin(pin);
    if (staffMember) {
      return res.json({ success: true, user: { id: staffMember.id, name: staffMember.name, type: "staff" } });
    }
    
    // Check packing workers (legacy)
    const packingWorker = await storage.verifyPackingWorkerPin(pin);
    if (packingWorker) {
      return res.json({ success: true, user: { id: packingWorker.id, name: packingWorker.name, type: "packing" } });
    }
    
    // Check delivery drivers (legacy)
    const driver = await storage.verifyDeliveryWorkerPin(pin);
    if (driver) {
      return res.json({ success: true, user: { id: driver.id, name: driver.name, type: "driver" } });
    }
    
    res.status(401).json({ success: false, message: "Invalid PIN" });
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
      deliveryPhotos: order.deliveryPhotos || [],
      deliveryPhoto: order.deliveryPhoto,
    });
  });

  // Public order tracking by order number (no auth required) - limited safe data only
  app.get("/api/orders/track/:orderNumber", async (req, res) => {
    let { orderNumber } = req.params;
    if (!orderNumber || orderNumber.length < 1) {
      return res.status(400).json({ message: "Invalid order number" });
    }
    // Normalize: if user enters just numbers, add ORD- prefix
    orderNumber = orderNumber.trim().toUpperCase();
    if (!orderNumber.startsWith("ORD-")) {
      orderNumber = `ORD-${orderNumber}`;
    }
    const order = await storage.getOrderByNumber(orderNumber);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    // Only show orders that are not yet delivered/picked up
    if (order.delivered) {
      return res.status(404).json({ message: "This order has already been delivered/picked up" });
    }
    // Return only safe, non-sensitive fields for public view (no financial data, no personal details)
    // Include current status based on workflow progress
    let currentStatus = "Received";
    if (order.tagDone && !order.washingDone && !order.packingDone) {
      currentStatus = "Tagged - In Process";
    } else if (order.washingDone && !order.packingDone) {
      currentStatus = "Washing Complete";
    } else if (order.packingDone && !order.delivered) {
      currentStatus = "Ready for Pickup/Delivery";
    }
    
    res.json({
      orderNumber: order.orderNumber,
      items: order.items,
      status: order.status,
      currentStatus: currentStatus,
      entryDate: order.entryDate,
      deliveryType: order.deliveryType,
      tagDone: order.tagDone,
      washingDone: order.washingDone,
      packingDone: order.packingDone,
      packingDate: order.packingDate,
      delivered: order.delivered,
      deliveryBy: order.deliveryBy,
      deliveryDate: order.deliveryDate,
      urgent: order.urgent,
      expectedDeliveryAt: order.expectedDeliveryAt,
      deliveryPhotos: order.deliveryPhotos || [],
      deliveryPhoto: order.deliveryPhoto,
      notes: order.notes,
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

  // Driver delivery confirmation endpoint
  app.post("/api/orders/:id/deliver-by-driver", async (req, res) => {
    const orderId = Number(req.params.id);
    const { pin, deliveryPhoto } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!pin) {
      return res.status(400).json({ message: "Driver PIN is required" });
    }

    // Verify PIN - accept ANY user PIN (universal PIN system like billing)
    const allUsers = await db.select().from(users);
    const activeUsers = allUsers.filter(u => u.active);
    
    // Find ANY user whose PIN matches (universal PIN system)
    let matchingUser = activeUsers.find(u => u.pin === pin);
    
    if (!matchingUser) {
      // Also check staff members
      const staffMember = await storage.verifyStaffMemberPin(pin);
      if (staffMember) {
        // Create a pseudo-user object for staff members
        matchingUser = { id: staffMember.id, name: staffMember.name, role: staffMember.roleType } as any;
      } else {
        // Check delivery workers (legacy)
        const deliveryWorker = await storage.verifyDeliveryWorkerPin(pin);
        if (deliveryWorker) {
          matchingUser = { id: deliveryWorker.id, name: deliveryWorker.name, role: 'driver' } as any;
        } else {
          return res.status(403).json({ message: "Invalid PIN" });
        }
      }
    }

    // Get the order
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order is in ready state (packed but not delivered)
    if (!order.packingDone) {
      return res.status(400).json({ message: "Order is not ready for delivery yet" });
    }

    if (order.delivered) {
      return res.status(400).json({ message: "Order already delivered" });
    }

    if (order.deliveryType !== 'delivery') {
      return res.status(400).json({ message: "This order is for pickup, not delivery" });
    }

    // Mark order as delivered with optional delivery photo
    const updateData: any = {
      delivered: true,
      status: "delivered",
      deliveryDate: new Date().toISOString(),
      deliveredByWorkerId: matchingUser!.id,
      deliveryBy: matchingUser!.name || (matchingUser as any).username,
    };

    // Add delivery photo if provided
    if (deliveryPhoto) {
      updateData.deliveryPhoto = deliveryPhoto;
      updateData.deliveryPhotos = [deliveryPhoto];
    }

    const updatedOrder = await storage.updateOrder(orderId, updateData);

    res.json(updatedOrder);
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

  // Batch toggle all items - more efficient for "check all" / "uncheck all"
  app.put("/api/stage-checklists/order/:orderId/:stage/toggle-all", async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const stage = req.params.stage;
      const { checkedItems, workerId, workerName } = req.body;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      
      if (!Array.isArray(checkedItems)) {
        return res.status(400).json({ message: "checkedItems must be an array" });
      }
      
      // Get checklist
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
      
      const checkedCount = checkedItems.length;
      const isComplete = checkedCount >= checklist.totalItems;
      
      const [updated] = await db
        .update(stageChecklists)
        .set({
          checkedItems: JSON.stringify(checkedItems),
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

  app.post("/api/admin/fix-order-amount", async (req, res) => {
    try {
      const { orderNumber, newAmount, adminPin } = req.body;
      if (adminPin !== "11111") {
        return res.status(403).json({ message: "Invalid admin PIN" });
      }
      if (!orderNumber || newAmount === undefined) {
        return res.status(400).json({ message: "orderNumber and newAmount required" });
      }

      const allOrders = await storage.getOrders();
      const order = allOrders.find(o => o.orderNumber === orderNumber);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      await storage.updateOrder(order.id, {
        totalAmount: newAmount.toString(),
        finalAmount: newAmount.toString(),
      });

      if (order.billId) {
        await storage.updateBill(order.billId, {
          amount: newAmount.toString(),
          paidAmount: newAmount.toString(),
        });
      }

      // Also fix related client transactions and balance
      if (order.billId && order.clientId) {
        const transactions = await storage.getClientTransactions(order.clientId);
        const relatedTxs = transactions.filter(t => t.billId === order.billId);
        const client = await storage.getClient(order.clientId);
        let balanceAdjust = 0;
        for (const tx of relatedTxs) {
          const oldAmt = parseFloat(tx.amount);
          if (oldAmt !== newAmount) {
            balanceAdjust += oldAmt - newAmount;
            await db.update(clientTransactions)
              .set({ amount: newAmount.toFixed(2) })
              .where(eq(clientTransactions.id, tx.id));
          }
        }
        if (client && balanceAdjust !== 0) {
          const newBalance = parseFloat(client.balance) + balanceAdjust;
          await storage.updateClient(client.id, { balance: newBalance.toFixed(2) });
        }
      }

      res.json({ success: true, message: `Order ${orderNumber} and bill updated to ${newAmount}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
