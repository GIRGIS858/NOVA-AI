import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nBETTER_AUTH_URL=http://localhost:3000\nNOVA_DATABASE_PATH=./data/nova.sqlite\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Created private local configuration. No secrets printed.");
} else {
  console.log("Keeping existing .env.local unchanged.");
}
