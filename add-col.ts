import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN onboarded_at timestamp with time zone;`);
    console.log("Column added successfully");
  } catch (error) {
    console.error("Error adding column:", error);
  }
  process.exit(0);
}

main();
