import { db } from "./db";
import { clients, bills, orders, clientTransactions, billPayments } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function mergeClientAccounts(sourceClientId: number, targetClientId: number) {
  try {
    const [sourceClient] = await db.select().from(clients).where(eq(clients.id, sourceClientId));
    const [targetClient] = await db.select().from(clients).where(eq(clients.id, targetClientId));

    if (!sourceClient || !targetClient) {
      throw new Error("One or both clients not found");
    }

    await db.update(bills).set({ clientId: targetClientId }).where(eq(bills.clientId, sourceClientId));
    await db.update(orders).set({ clientId: targetClientId }).where(eq(orders.clientId, sourceClientId));
    await db.update(clientTransactions).set({ clientId: targetClientId }).where(eq(clientTransactions.clientId, sourceClientId));
    await db.update(billPayments).set({ clientId: targetClientId }).where(eq(billPayments.clientId, sourceClientId));

    const newAmount = (parseFloat(targetClient.amount || "0") + parseFloat(sourceClient.amount || "0")).toFixed(2);
    const newDeposit = (parseFloat(targetClient.deposit || "0") + parseFloat(sourceClient.deposit || "0")).toFixed(2);
    const newBalance = (parseFloat(targetClient.balance || "0") + parseFloat(sourceClient.balance || "0")).toFixed(2);

    await db.update(clients).set({ amount: newAmount, deposit: newDeposit, balance: newBalance }).where(eq(clients.id, targetClientId));
    await db.delete(clients).where(eq(clients.id, sourceClientId));

    return { success: true, mergedInto: targetClientId };
  } catch (error) {
    console.error("Merge error:", error);
    throw error;
  }
}
