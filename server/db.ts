import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Use environment-specific database URL
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/laundry_db";

// Configure postgres connection with error handling
const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // Suppress notices
});

export const db = drizzle(sql, { schema });