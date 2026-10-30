import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { projectStore } from "../src/lib/projects";
import { signupFixture } from "./fixture-signup";

test("manual source editing, immutable restoration, stale drafts and owner-only routes", async ({
  page,
  browser,
  baseURL,
}) => {
  if (!baseURL || !process.env.NOVA_E2E_DATABASE_PATH)
    throw new Error("Isolated database required");
  const origin = new URL(baseURL).origin;
  const signup = await signupFixture(() =>
    page.request.post("/api/auth/sign-up/email", {
      headers: { Origin: origin },
      data: {
        email: `source-${randomUUID()}@example.com`,
        password: "Source-test-password-2026!",
        name: "Source editor reviewer",
      },
    }),
  );
  expect(signup.ok()).toBe(true);
  const { user } = await signup.json();
  const db = new Database(process.env.NOVA_E2E_DATABASE_PATH);
  db.pragma("foreign_keys = ON");
  const projects = projectStore(db);
  const project = projects.create(user.id, {
    name: "Manual portfolio",
    brief: "A portfolio edited manually without an AI credential.",
  });
  const base = `/api/projects/${project}`;
  const anonymous = await browser.newContext();
  const other = await browser.newContext();
  const files = [
    { path: "index.html", content: "<main><h1>First manual site</h1></main>" },
    { path: "styles.css", content: "body { color: #abc; background: #123; }" },
  ];
  try {
    expect(
      (
        await anonymous.request.post(`${baseURL}${base}/source`, {
          headers: { Origin: origin },
          data: { baseVersionId: null, files },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post(`${base}/source`, {
          headers: { Origin: "https://untrusted.example" },
          data: { baseVersionId: null, files },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(`${base}/source`, {
          headers: { Origin: origin },
          data: {
            baseVersionId: null,
            files: [
              { path: "index.html", content: "<script>evil()</script>" },
              files[1],
            ],
          },
        })
      ).status(),
    ).toBe(422);
    expect(
      (
        await page.request.post(`${base}/source`, {
          headers: { Origin: origin, "Content-Type": "application/json" },
          data: "x".repeat(768 * 1024 + 1),
        })
      ).status(),
    ).toBe(400);
    await page.goto(`/app/projects/${project}`);
    await page
      .getByRole("button", { name: "أضف ملفات يدويًا", exact: true })
      .click();
    await page
      .getByLabel("تعديل index.html", { exact: true })
      .fill(files[0].content);
    await page
      .locator(".static-editor")
      .getByRole("button", { name: "styles.css", exact: true })
      .click();
    await page
      .getByLabel("تعديل styles.css", { exact: true })
      .fill(files[1].content);
    await page
      .getByRole("button", { name: "احفظ إصدارًا جديدًا", exact: true })
      .click();
    const previewHeading = (name: string) =>
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name, exact: true });
    await expect(previewHeading("First manual site")).toBeVisible();
    let history = await (await page.request.get(`${base}/generation`)).json();
    const first = history.versions[0].id as string;
    expect(history.versions).toHaveLength(1);
    expect(history.runs).toEqual([]); // Manual work never consumes AI attempts.
    expect(history.configured).toBe(false);

    await page
      .getByRole("button", { name: "عدّل النسخة الأحدث", exact: true })
      .click();
    await page
      .getByLabel("تعديل index.html", { exact: true })
      .fill("<h1>Second manual site</h1>");
    await page
      .getByRole("button", { name: "احفظ إصدارًا جديدًا", exact: true })
      .click();
    await expect(previewHeading("Second manual site")).toBeVisible();
    history = await (await page.request.get(`${base}/generation`)).json();
    const second = history.versions[0].id as string;
    expect(history.versions.map((v: { number: number }) => v.number)).toEqual([
      2, 1,
    ]);
    const old = await (
      await page.request.get(`${base}/versions/${first}`)
    ).json();
    expect(old.version.files).toEqual(files);

    await page
      .getByRole("button", { name: "قارن الإصدارات", exact: true })
      .click();
    await expect(
      page.getByLabel("تغييرات index.html", { exact: true }),
    ).toContainText("First manual site");
    await expect(page.locator(".diff-added")).toContainText(
      "Second manual site",
    );
    await expect(page.locator(".diff-removed")).toContainText(
      "First manual site",
    );
    await expect(
      page.locator(".comparison-file").filter({ hasText: "styles.css" }),
    ).toContainText("لا تغييرات");
    await page.getByRole("button", { name: "المعاينة", exact: true }).click();

    await page
      .getByRole("combobox", { name: "الإصدار المحفوظ", exact: true })
      .selectOption(first);
    await expect(previewHeading("First manual site")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "استعد كإصدار جديد", exact: true })
      .click();
    await expect(
      page
        .getByRole("combobox", { name: "الإصدار المحفوظ", exact: true })
        .locator("option"),
    ).toHaveCount(3);
    await expect(previewHeading("First manual site")).toBeVisible();
    history = await (await page.request.get(`${base}/generation`)).json();
    const restored = history.versions[0].id as string;
    expect(history.versions[0].restored_from).toBe(first);
    expect(restored).not.toBe(first);

    // A second tab commits while this editor keeps its original base and draft.
    await page
      .getByRole("button", { name: "عدّل النسخة الأحدث", exact: true })
      .click();
    await page
      .getByLabel("تعديل index.html", { exact: true })
      .fill("<h1>My unsaved draft</h1>");
    const remoteFiles = [
      { path: "index.html", content: "<h1>Another session saved this</h1>" },
      files[1],
    ];
    const concurrent = await page.request.post(`${base}/source`, {
      headers: { Origin: origin },
      data: { baseVersionId: restored, files: remoteFiles },
    });
    expect(concurrent.status()).toBe(201);
    const newest = (await concurrent.json()).version.id;
    await page
      .getByRole("button", { name: "احفظ إصدارًا جديدًا", exact: true })
      .click();
    await expect(page.locator(".static-editor [role=alert]")).toContainText(
      "مسودتك محفوظة هنا",
    );
    await expect(
      page.getByLabel("تعديل index.html", { exact: true }),
    ).toHaveValue("<h1>My unsaved draft</h1>");
    expect(
      (
        await page.request.post(`${base}/source/restore`, {
          headers: { Origin: origin },
          data: { baseVersionId: restored, versionId: second },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await (await page.request.get(`${base}/versions/${newest}`)).json())
        .version.files,
    ).toEqual(remoteFiles);

    const otherSignup = await signupFixture(() =>
      other.request.post(`${baseURL}/api/auth/sign-up/email`, {
        headers: { Origin: origin },
        data: {
          email: `source-other-${randomUUID()}@example.com`,
          password: "Other-source-password-2026!",
          name: "Other owner",
        },
      }),
    );
    expect(otherSignup.ok()).toBe(true);
    for (const suffix of ["source", "source/restore"]) {
      expect(
        (
          await other.request.post(`${baseURL}${base}/${suffix}`, {
            headers: { Origin: origin },
            data: { baseVersionId: newest, versionId: first, files },
          })
        ).status(),
      ).toBe(404);
    }
    expect(
      (
        await other.request.get(`${baseURL}${base}/versions/${newest}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(`${base}/source/restore`, {
          headers: { Origin: "https://untrusted.example" },
          data: { baseVersionId: newest, versionId: first },
        })
      ).status(),
    ).toBe(403);
    history = await (await page.request.get(`${base}/generation`)).json();
    expect(history.versions).toHaveLength(4);
    expect(history.runs).toEqual([]);

    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/nova-source-editor-mobile-ar.png",
      fullPage: true,
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "أغلق المحرّر", exact: true })
      .click();
    await page.getByRole("button", { name: "حدّث السجل", exact: true }).click();
    await page
      .getByRole("combobox", { name: "الإصدار المحفوظ", exact: true })
      .selectOption(newest);
    await expect(previewHeading("Another session saved this")).toBeVisible();
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page
      .getByRole("button", { name: "Compare versions", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Compare from version", exact: true })
      .selectOption(first);
    await expect(
      page.getByLabel("Changes in index.html", { exact: true }),
    ).toContainText("Another session saved this");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit latest version", exact: true })
      .click();
    await expect(
      page.getByLabel("Edit index.html", { exact: true }),
    ).toHaveValue(remoteFiles[0].content);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
  } finally {
    await Promise.allSettled([anonymous.close(), other.close()]);
    projects.remove(user.id, project);
    db.close();
  }
});
