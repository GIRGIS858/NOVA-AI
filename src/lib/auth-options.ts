import type Database from "better-sqlite3";
import type { BetterAuthOptions } from "better-auth";
export function authOptions(database: Database.Database): BetterAuthOptions {
  if (!process.env.BETTER_AUTH_SECRET)
    throw new Error(
      "Set BETTER_AUTH_SECRET before starting Nova. See README.md.",
    );
  return {
    database,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    rateLimit: { enabled: true, storage: "database" },
  };
}
