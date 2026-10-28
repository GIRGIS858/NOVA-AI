import nextEnv from "@next/env";
import { getMigrations } from "better-auth/db/migration";
nextEnv.loadEnvConfig(process.cwd());
const { db } = await import("../src/lib/db");
const { authOptions } = await import("../src/lib/auth-options");
try {
  const plan = await getMigrations(authOptions(db));
  await plan.runMigrations();
  console.log("Database schema is up to date.");
} finally {
  db.close();
}
