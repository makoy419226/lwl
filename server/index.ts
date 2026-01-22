import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { sendDailySalesReportEmail, type DailySalesData } from "./resend";
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

  // Daily sales report scheduler
  const ADMIN_REPORT_EMAIL = process.env.ADMIN_REPORT_EMAIL || "idusma0010@gmail.com";
  
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

  async function sendScheduledDailyReport() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const salesData = await generateDailySalesData(yesterday);
      await sendDailySalesReportEmail(ADMIN_REPORT_EMAIL, salesData);
      log(`Daily sales report sent to ${ADMIN_REPORT_EMAIL}`, "scheduler");
    } catch (err: any) {
      log(`Failed to send daily report: ${err.message}`, "scheduler");
    }
  }

  // Schedule daily report at 1:00 AM UAE time (UTC+4)
  function scheduleNextDailyReport() {
    const now = new Date();
    const uaeOffset = 4 * 60 * 60 * 1000; // UAE is UTC+4
    const nowUAE = new Date(now.getTime() + uaeOffset);
    
    // Set target time to 1:00 AM UAE
    const targetUAE = new Date(nowUAE);
    targetUAE.setHours(1, 0, 0, 0);
    
    // If we've passed 1 AM today, schedule for tomorrow
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

  // Start the scheduler
  scheduleNextDailyReport();
  log(`Daily sales report scheduler started (will send to ${ADMIN_REPORT_EMAIL} at 1:00 AM UAE time)`, "scheduler");
})();
