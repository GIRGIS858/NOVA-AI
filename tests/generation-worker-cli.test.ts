import { expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import Database from "better-sqlite3";
import { projectStore } from "../src/lib/projects";
import { migrateSourceVersions } from "../src/lib/versions";
import { migrateGeneration } from "../src/lib/generation-store";
import { generationQueue, QUEUE_WAIT_MS } from "../src/lib/generation-queue";

it("the actual worker command reconciles expired queued work while disabled and exits cleanly", async () => {
  const folder = mkdtempSync(join(tmpdir(), "nova-worker-cli-"));
  const databasePath = join(folder, "worker.sqlite");
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  const project = projectStore(db).create("owner", {
    name: "Worker process",
    brief: "Private process integration fixture.",
  });
  migrateSourceVersions(db);
  migrateGeneration(db);
  generationQueue(db).enqueue(
    "owner",
    project,
    randomUUID(),
    { provider: "ollama", model: "fixture:7b" },
    Date.now() - QUEUE_WAIT_MS - 1000,
  );
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/generation-worker.ts"],
    {
      env: {
        ...process.env,
        NOVA_DATABASE_PATH: databasePath,
        NOVA_AI_ENABLED: "0",
        NOVA_AI_API_KEY: "",
      },
      stdio: "pipe",
    },
  );
  let log = "";
  child.stdout.on("data", (data) => {
    log += data.toString();
  });
  child.stderr.on("data", (data) => {
    log += data.toString();
  });
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
  try {
    let status = "running";
    for (let n = 0; n < 80 && status === "running"; n++) {
      await delay(50);
      status = (
        db.prepare("SELECT status FROM generation_runs").get() as {
          status: string;
        }
      ).status;
    }
    expect(status).toBe("failed");
    expect(db.prepare("SELECT error_code FROM generation_runs").get()).toEqual({
      error_code: "interrupted",
    });
    expect(
      db.prepare("SELECT payload_json FROM generation_jobs").get(),
    ).toEqual({ payload_json: null });
    expect(log).toContain("worker started");
    expect(log).not.toContain("Private process");
    child.kill("SIGTERM");
    expect(await exit).toBe(0);
  } finally {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    await exit;
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
}, 10_000);
