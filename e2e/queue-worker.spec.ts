import { expect, test } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { projectStore } from "../src/lib/projects";

test("queued HTTP work survives navigation, runs in a separate worker, and cancels safely", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const socket = createServer();
  await new Promise<void>((done) => socket.listen(0, "127.0.0.1", done));
  const port = (socket.address() as AddressInfo).port;
  await new Promise<void>((done) => socket.close(() => done()));
  const origin = `http://localhost:${port}`;
  const databasePath = resolve("data/e2e", `queue-${randomUUID()}.sqlite`);
  const env = {
    ...process.env,
    NOVA_DATABASE_PATH: databasePath,
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    NOVA_AI_PROVIDER: "ollama",
    NOVA_OLLAMA_MODEL: "fixture:7b",
    NOVA_AI_ENABLED: "1",
    NOVA_AI_API_KEY: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
    env,
    stdio: "pipe",
    timeout: 30_000,
  });
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { env, stdio: "ignore" },
  );
  const stopped = new Promise<void>((done) =>
    server.once("exit", () => done()),
  );
  let db: Database.Database | undefined;
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await page.request.get(origin)).status();
          } catch {
            return 0;
          }
        },
        { timeout: 20_000 },
      )
      .toBe(200);
    const signup = await page.request.post(`${origin}/api/auth/sign-up/email`, {
      headers: { Origin: origin },
      data: {
        email: `queue-${randomUUID()}@example.com`,
        password: "Queue-fixture-password-2026!",
        name: "Queue fixture",
      },
    });
    expect(signup.status()).toBe(200);
    const { user } = await signup.json();
    db = new Database(databasePath);
    db.pragma("foreign_keys = ON");
    const project = projectStore(db).create(user.id, {
      name: "Durable worker project",
      brief: "A private durable queue browser fixture.",
    });
    const base = `${origin}/api/projects/${project}`;
    const requestId = randomUUID();
    const enqueue = () =>
      page.request.post(`${base}/generate`, {
        headers: { Origin: origin },
        data: { requestId },
      });
    const accepted = await enqueue();
    expect(accepted.status()).toBe(202);
    const { run } = await accepted.json();
    expect(run.phase).toBe("queued");
    const replay = await enqueue();
    expect(replay.status()).toBe(200);
    expect((await replay.json()).run.id).toBe(run.id);
    await page.goto(`${origin}/app/projects/${project}`);
    await expect(page.locator(".generation-live")).toHaveText(
      "بانتظار التنفيذ",
    );
    await page.reload();
    await expect(page.locator(".generation-live")).toHaveText(
      "بانتظار التنفيذ",
    );
    // A separate Node process executes the actual queue worker with explicitly injected fixture output.
    // No model service or real inference is used by this browser test.
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import { db } from './src/lib/db.ts';
      import { generationQueue } from './src/lib/generation-queue.ts';
      import { processNextGeneration } from './src/lib/generation-worker.ts';
      try {
        await processNextGeneration(generationQueue(db), {
          provider: 'ollama', model: 'fixture:7b', apiKey: '', signal: new AbortController().signal,
          generate: async () => [{path:'index.html', content:'<h1>Durable worker fixture</h1>'}, {path:'styles.css',content:'h1{color:teal}'}]
        });
      } finally { db.close(); }
    `,
      ],
      { env, stdio: "pipe", timeout: 15_000 },
    );
    await expect(page.locator(".generation-live")).toHaveText("نسخة محفوظة");
    await expect(
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name: "Durable worker fixture" }),
    ).toBeVisible();
    await page.locator(".generation-history summary").click();
    const progress = page.getByRole("list", { name: "مراحل المهمة" });
    await expect(progress).toContainText("جارٍ التحقق من الملفات");
    const history = await (await page.request.get(`${base}/generation`)).json();
    expect(
      history.runs[0].events.map((e: { phase: string }) => e.phase),
    ).toEqual(["queued", "generating", "validating", "succeeded"]);
    expect(JSON.stringify(history)).not.toContain(
      "A private durable queue browser fixture",
    );
    expect(history.versions).toHaveLength(1);
    await page
      .getByRole("button", { name: "ولّد نسخة جديدة", exact: true })
      .click();
    await expect(page.locator(".generation-live")).toHaveText(
      "بانتظار التنفيذ",
    );
    await page
      .getByRole("button", { name: "ألغِ المحاولة", exact: true })
      .click();
    await expect(page.locator(".generation-live")).toHaveText("ملغاة");
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM generation_jobs WHERE payload_json IS NOT NULL",
        )
        .get(),
    ).toEqual({ n: 0 });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    // Locale refresh preserves the details element's open state.
    if (
      (await page.locator(".generation-history").getAttribute("open")) === null
    )
      await page.locator(".generation-history summary").click();
    await expect(
      page.getByRole("list", { name: "Task progress" }).first(),
    ).toContainText("Cancelled");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name: "Durable worker fixture" }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/nova-worker-progress-mobile.png",
      fullPage: true,
    });
  } finally {
    db?.close();
    server.kill("SIGTERM");
    await stopped;
  }
});
