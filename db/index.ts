import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
      "Add it to .env.local, for example: DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/clipfun",
  );
}

// For query purposes (connection pool)
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
