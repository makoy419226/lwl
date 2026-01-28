import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { sendDailySalesReportEmailSMTP, sendSalesReportEmailSMTP, type DailySalesData, type SalesReportData, type ReportPeriod } from "./smtp";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb', // Allow larger payloads for delivery photos
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve attached_assets folder for logos and other assets
  const path = await import("path");
  app.use("/attached_assets", express.static(path.resolve(process.cwd(), "attached_assets")));
  
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // Daily sales report scheduler - fetch admin email dynamically from database
  async function getAdminReportEmail(): Promise<string> {
    try {
      const adminUser = await storage.getUserByUsername("admin");
      return adminUser?.email || process.env.ADMIN_REPORT_EMAIL || "idusma0010@gmail.com";
    } catch {
      return process.env.ADMIN_REPORT_EMAIL || "idusma0010@gmail.com";
    }
  }
  
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

  async function sendScheduledDailyReport() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const salesData = await generateDailySalesData(yesterday);
      const adminEmail = await getAdminReportEmail();
      await sendDailySalesReportEmailSMTP(adminEmail, salesData);
      log(`Daily sales report sent to ${adminEmail}`, "scheduler");
    } catch (err: any) {
      log(`Failed to send daily report: ${err.message}`, "scheduler");
    }
  }

  // Schedule daily report at 11:59 PM UAE time (UTC+4)
  function scheduleNextDailyReport() {
    const now = new Date();
    const uaeOffset = 4 * 60 * 60 * 1000; // UAE is UTC+4
    const nowUAE = new Date(now.getTime() + uaeOffset);
    
    // Set target time to 11:59 PM UAE
    const targetUAE = new Date(nowUAE);
    targetUAE.setHours(23, 59, 0, 0);
    
    // If we've passed 11:59 PM today, schedule for tomorrow
    if (nowUAE >= targetUAE) {
      targetUAE.setDate(targetUAE.getDate() + 1);
    }
    
    // Convert back to local time for setTimeout
    const targetLocal = new Date(targetUAE.getTime() - uaeOffset);
    const msUntilTarget = targetLocal.getTime() - now.getTime();
    
    log(`Next daily report scheduled in ${Math.round(msUntilTarget / 1000 / 60)} minutes`, "scheduler");
    
    setTimeout(async () => {
      await sendScheduledDailyReport();
      scheduleNextDailyReport(); // Schedule the next one
    }, msUntilTarget);
  }

  // Start the daily scheduler
  scheduleNextDailyReport();
  getAdminReportEmail().then(email => {
    log(`Daily sales report scheduler started (will send to ${email} at 11:59 PM UAE time)`, "scheduler");
  });

  // Generate sales data for any date range
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

  // Track what reports have been sent today to avoid duplicates
  let lastWeeklyReportDate = '';
  let lastMonthlyReportDate = '';
  let lastYearlyReportDate = '';

  // Send weekly report (Saturday)
  async function sendScheduledWeeklyReport() {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(now);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const salesData = await generateSalesReportData(startOfWeek, endOfWeek, 'weekly');
      const adminEmail = await getAdminReportEmail();
      await sendSalesReportEmailSMTP(adminEmail, salesData);
      log(`Weekly sales report sent to ${adminEmail}`, "scheduler");
    } catch (err: any) {
      log(`Failed to send weekly report: ${err.message}`, "scheduler");
    }
  }

  // Send monthly report (last day of month)
  async function sendScheduledMonthlyReport() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(now);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const salesData = await generateSalesReportData(startOfMonth, endOfMonth, 'monthly');
      const adminEmail = await getAdminReportEmail();
      await sendSalesReportEmailSMTP(adminEmail, salesData);
      log(`Monthly sales report sent to ${adminEmail}`, "scheduler");
    } catch (err: any) {
      log(`Failed to send monthly report: ${err.message}`, "scheduler");
    }
  }

  // Send yearly report (December 31st)
  async function sendScheduledYearlyReport() {
    try {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      const endOfYear = new Date(now);
      endOfYear.setHours(23, 59, 59, 999);
      
      const salesData = await generateSalesReportData(startOfYear, endOfYear, 'yearly');
      const adminEmail = await getAdminReportEmail();
      await sendSalesReportEmailSMTP(adminEmail, salesData);
      log(`Yearly sales report sent to ${adminEmail}`, "scheduler");
    } catch (err: any) {
      log(`Failed to send yearly report: ${err.message}`, "scheduler");
    }
  }

  // Check and send periodic reports at 11:59 PM UAE time
  async function checkAndSendPeriodicReports() {
    const now = new Date();
    const uaeOffset = 4 * 60 * 60 * 1000;
    const nowUAE = new Date(now.getTime() + uaeOffset);
    const todayKey = nowUAE.toISOString().split('T')[0];
    const hour = nowUAE.getHours();
    const minute = nowUAE.getMinutes();
    
    // Only send at 11:59 PM UAE time (23:59)
    if (hour === 23 && minute === 59) {
      const dayOfWeek = nowUAE.getDay(); // 0=Sunday, 6=Saturday
      const dayOfMonth = nowUAE.getDate();
      const lastDayOfMonth = new Date(nowUAE.getFullYear(), nowUAE.getMonth() + 1, 0).getDate();
      const month = nowUAE.getMonth();
      
      // Weekly report - Saturday (day 6)
      if (dayOfWeek === 6 && lastWeeklyReportDate !== todayKey) {
        lastWeeklyReportDate = todayKey;
        await sendScheduledWeeklyReport();
      }
      
      // Monthly report - last day of month
      if (dayOfMonth === lastDayOfMonth && lastMonthlyReportDate !== todayKey) {
        lastMonthlyReportDate = todayKey;
        await sendScheduledMonthlyReport();
      }
      
      // Yearly report - December 31st
      if (month === 11 && dayOfMonth === 31 && lastYearlyReportDate !== todayKey) {
        lastYearlyReportDate = todayKey;
        await sendScheduledYearlyReport();
      }
    }
  }

  // Check every minute for periodic reports
  setInterval(checkAndSendPeriodicReports, 60 * 1000);
  log(`Periodic reports scheduler started: Weekly (Saturday), Monthly (last day), Yearly (Dec 31) - all at 11:59 PM UAE time`, "scheduler");
})();
