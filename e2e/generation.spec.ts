import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { projectStore } from "../src/lib/projects";
import { generationStore } from "../src/lib/generation-store";

import { signupFixture } from "./fixture-signup";

// Fixtures are persisted test artifacts, not provider output. No runtime mock mode exists.
test("static versions, ownership, missing-provider gate, and cancellation", async ({
  page,
  browser,
  baseURL,
}) => {
  if (!baseURL || !process.env.NOVA_E2E_DATABASE_PATH) {
    throw new Error(
      "Generation E2E requires the isolated suite configuration.",
    );
  }
  const origin = new URL(baseURL).origin;
  const signup = await signupFixture(() =>
    page.request.post("/api/auth/sign-up/email", {
      headers: { Origin: origin },
      data: {
        email: `generation-${randomUUID()}@example.com`,
        password: "Generation-test-password-2026!",
        name: "Generation reviewer",
      },
    }),
  );
  expect(signup.ok()).toBe(true);
  const { user } = await signup.json();
  expect(typeof user.id).toBe("string");
  const db = new Database(process.env.NOVA_E2E_DATABASE_PATH!);
  db.pragma("foreign_keys = ON");
  const projects = projectStore(db);
  const generations = generationStore(db);
  const projectId = projects.create(user.id, {
    name: "Static version fixture",
    brief: "A static portfolio fixture for end-to-end integration validation.",
  });
  const base = `/api/projects/${projectId}`;
  const files = [
    {
      path: "index.html",
      content:
        '<main><h1>Saved fixture version</h1><p id="about">Persisted source, not a live AI response.</p></main>',
    },
    {
      path: "styles.css",
      content: "body { color: #123; background: #eff; padding: 24px; }",
    },
  ];
  const first = generations.reserve(user.id, projectId, randomUUID());
  const version = generations.complete(user.id, first.run.id, files)!;
  const active = generations.reserve(user.id, projectId, randomUUID());
  const other = await browser.newContext();
  const anonymous = await browser.newContext();
  try {
    const otherSignup = await signupFixture(() =>
      other.request.post(`${baseURL}/api/auth/sign-up/email`, {
        headers: { Origin: origin },
        data: {
          email: `generation-other-${randomUUID()}@example.com`,
          password: "Other-generation-password-2026!",
          name: "Other generation reviewer",
        },
      }),
    );
    expect(otherSignup.ok()).toBe(true);
    expect(
      (
        await anonymous.request.get(`${baseURL}${base}/versions/${version.id}`)
      ).status(),
    ).toBe(401);
    expect(
      (
        await other.request.get(`${baseURL}${base}/versions/${version.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (await other.request.get(`${baseURL}${base}/generation`)).status(),
    ).toBe(404);
    expect(
      (
        await other.request.post(
          `${baseURL}${base}/generation/${active.run.id}/cancel`,
          {
            headers: { Origin: origin },
          },
        )
      ).status(),
    ).toBe(404);
    expect(generations.getRun(user.id, active.run.id)?.status).toBe("running");

    const crossed = await page.request.post(`${base}/generate`, {
      headers: { Origin: "https://untrusted.example" },
      data: { requestId: randomUUID() },
    });
    expect(crossed.status()).toBe(403);
    const noOrigin = await page.request.post(`${base}/generate`, {
      data: { requestId: randomUUID() },
    });
    expect(noOrigin.status()).toBe(403);
    const unavailable = await page.request.post(`${base}/generate`, {
      headers: { Origin: origin },
      data: { requestId: randomUUID() },
    });
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "not_configured" });
    expect(generations.runs(user.id, projectId)).toHaveLength(2);

    await page.goto(`/app/projects/${projectId}`);
    await expect(
      page.locator(".generation-limits").filter({ hasText: "Ollama · local" }),
    ).toBeVisible();
    await expect(page.locator(".generation-description")).toContainText(
      "Ollama",
    );
    await page.waitForLoadState("networkidle");
    const preview = page.locator("iframe.generation-preview");
    await expect(preview).toHaveAttribute("sandbox", "");
    await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name: "Saved fixture version" }),
    ).toBeVisible();
    await expect(
      page.getByText("التوليد غير مهيّأ بعد.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "ألغِ المحاولة", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "ولّد نسخة جديدة", exact: true }),
    ).toBeDisabled();
    expect(generations.getRun(user.id, active.run.id)?.status).toBe(
      "cancelled",
    );
    await page.getByText("سجل المحاولات", { exact: false }).click();
    await expect(page.locator(".generation-history li")).toHaveCount(2);
    await page.getByRole("button", { name: "الملفات", exact: true }).click();
    await expect(page.getByLabel("محتوى الملف")).toContainText(
      files[0].content,
    );
    await page.getByRole("button", { name: "styles.css", exact: true }).click();
    await expect(page.getByLabel("محتوى الملف")).toHaveText(files[1].content);
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "تنزيل JSON", exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(`nova-source-${version.id}.json`);
    const downloaded = JSON.parse(
      await readFile((await download.path())!, "utf8"),
    );
    expect(downloaded).toEqual({ version: version.id, files });
    await page.getByRole("button", { name: "المعاينة", exact: true }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name: "Saved fixture version" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/nova-generation-mobile-ar.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("button", { name: "Generate a new version", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name: "Saved fixture version" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/nova-generation-mobile-en.png",
      fullPage: true,
    });
  } finally {
    await other.close();
    await anonymous.close();
    projects.remove(user.id, projectId);
    db.close();
  }
});
