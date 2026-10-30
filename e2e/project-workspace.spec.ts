import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { projectStore } from "../src/lib/projects";
import { signupFixture } from "./fixture-signup";

test("multi-file editing, complete exports, conflicts, immutable restore and bilingual navigation", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  if (!baseURL || !process.env.NOVA_E2E_DATABASE_PATH)
    throw new Error("Isolated database required");
  const origin = new URL(baseURL).origin;
  const signup = await signupFixture(() =>
    page.request.post("/api/auth/sign-up/email", {
      headers: { Origin: origin },
      data: {
        email: `files-${randomUUID()}@example.com`,
        password: "Workspace-password-2026!",
        name: "Workspace reviewer",
      },
    }),
  );
  expect(signup.ok()).toBe(true);
  const { user } = await signup.json();
  const db = new Database(process.env.NOVA_E2E_DATABASE_PATH);
  db.pragma("foreign_keys = ON");
  const projects = projectStore(db);
  const project = projects.create(user.id, {
    name: "Full-stack workspace",
    brief:
      "A React and Node application with editable frontend and backend files.",
  });
  const base = `/api/projects/${project}/workspace`;
  const anonymous = await browser.newContext();
  const other = await browser.newContext();
  const post = (path: string, data: unknown) =>
    page.request.post(`${base}${path}`, { headers: { Origin: origin }, data });
  const snapshot = async () => await (await page.request.get(base)).json();
  const open = (path: string) =>
    page.getByRole("button", { name: `افتح ${path}`, exact: true }).click();
  const content = (path: string) =>
    page.getByLabel(`محتوى ${path}`, { exact: true });
  const save = () =>
    page.getByRole("button", { name: "احفظ إصدارًا", exact: true }).click();
  try {
    expect((await anonymous.request.get(`${baseURL}${base}`)).status()).toBe(
      401,
    );
    expect(
      (
        await anonymous.request.post(`${baseURL}${base}/template`, {
          headers: { Origin: origin },
          data: { baseVersionId: null },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post(`${base}/template`, {
          headers: { Origin: "https://untrusted.example" },
          data: { baseVersionId: null },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(base, {
          headers: { Origin: origin, "Content-Type": "application/json" },
          data: "{",
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await post("", {
          baseVersionId: null,
          files: [{ path: "../escape.js", content: "" }],
        })
      ).status(),
    ).toBe(422);
    expect(
      (
        await post("", {
          baseVersionId: null,
          files: [{ path: "huge.txt", content: "x".repeat(256 * 1024 + 1) }],
        })
      ).status(),
    ).toBe(409);
    expect((await page.request.get(`${base}/export`)).status()).toBe(400);
    expect(
      (
        await page.request.get(
          `${base}/export?version=${randomUUID()}&version=${randomUUID()}`,
        )
      ).status(),
    ).toBe(400);

    await page.goto(`/app/projects/${project}`);
    await page
      .getByRole("link", { name: "ملفات المشروع", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "ملفات المشروع", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "ابدأ بقالب فل ستاك", exact: true })
      .click();
    await expect(
      page.getByText("حُفظ قالب البداية. يمكنك تعديل ملفاته الآن.", {
        exact: true,
      }),
    ).toBeVisible();
    const first = (await snapshot()).version;
    expect(
      first.files.some(
        (file: { path: string }) => file.path === "server/app.mjs",
      ),
    ).toBe(true);
    expect(
      first.files.some(
        (file: { path: string }) => file.path === "web/main.jsx",
      ),
    ).toBe(true);
    expect((await post("/template", { baseVersionId: null })).status()).toBe(
      409,
    );
    await open("web/main.jsx");
    const edited = `${await content("web/main.jsx").inputValue()}\n// تعديل محفوظ من مساحة الملفات\n`;
    await content("web/main.jsx").fill(edited);

    await page.getByRole("button", { name: "ملف جديد", exact: true }).click();
    await page
      .getByLabel("مسار الملف", { exact: true })
      .fill("shared/message.js");
    await page.getByRole("button", { name: "أضف الملف", exact: true }).click();
    await content("shared/message.js").fill(
      'export const message = "مرحبا من Nova";\n',
    );
    await page
      .getByRole("button", { name: "أعد تسمية الملف", exact: true })
      .click();
    await page
      .getByLabel("مسار الملف", { exact: true })
      .fill("shared/Message.js");
    await page.getByRole("button", { name: "احفظ الاسم", exact: true }).click();
    await save();
    await expect(
      page.getByText("حُفظ إصدار جديد بكل التعديلات.", { exact: true }),
    ).toBeVisible();
    const second = (await snapshot()).version;
    expect(second.number).toBe(2);
    expect(
      second.files.find(
        (file: { path: string }) => file.path === "web/main.jsx",
      ).content,
    ).toBe(edited);
    const old = await (
      await page.request.get(`${base}?version=${first.id}`)
    ).json();
    expect(old.version.files).toEqual(first.files);

    const zipPromise = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "نزّل الإصدار ZIP", exact: true })
      .click();
    const zip = await zipPromise;
    expect(zip.suggestedFilename()).toContain(".zip");
    expect(
      (await readFile((await zip.path())!)).subarray(0, 4).toString("hex"),
    ).toBe("504b0304");

    // Another session saves while this page keeps the original base and unsaved text.
    const draftText = 'export const message = "My retained draft";\n';
    await content("shared/Message.js").fill(draftText);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("link", { name: "العودة للمشروع", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/projects/${project}/files$`));
    const concurrentFiles = second.files.map(
      (file: { path: string; content: string }) =>
        file.path === "shared/Message.js"
          ? { ...file, content: "// Concurrent save\n" }
          : file,
    );
    const concurrent = await post("", {
      baseVersionId: second.id,
      files: concurrentFiles,
    });
    expect(concurrent.status()).toBe(201);
    const third = (await concurrent.json()).version;
    await save();
    await expect(page.locator(".file-workspace [role=alert]")).toContainText(
      "مسودتك محفوظة هنا",
    );
    await expect(content("shared/Message.js")).toHaveValue(draftText);
    const draftPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "نزّل المسودة JSON", exact: true })
      .click();
    const draft = JSON.parse(
      await readFile((await (await draftPromise).path())!, "utf8"),
    );
    expect(draft.baseVersionId).toBe(second.id);
    expect(
      draft.files.find(
        (file: { path: string }) => file.path === "shared/Message.js",
      ).content,
    ).toBe(draftText);
    await save();
    await expect(page.locator(".file-workspace [role=alert]")).toContainText(
      "مسودتك محفوظة هنا",
    );
    expect((await snapshot()).version.id).toBe(third.id);

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "افتح الأحدث", exact: true })
      .click();
    await expect(content("shared/Message.js")).toHaveValue(
      "// Concurrent save\n",
    );
    await page
      .getByRole("combobox", { name: "الإصدار المحفوظ", exact: true })
      .selectOption(first.id);
    await open("web/main.jsx");
    await expect(content("web/main.jsx")).toHaveAttribute("readonly", "");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "استعد كإصدار جديد", exact: true })
      .click();
    await expect(
      page.getByText("استُعيدت الملفات كإصدار جديد.", { exact: true }),
    ).toBeVisible();
    const restored = (await snapshot()).version;
    expect(restored.restoredFrom).toBe(first.id);
    expect(restored.files).toEqual(first.files);
    await open("README.md");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "احذف الملف", exact: true }).click();
    await save();
    await expect(
      page.getByText("حُفظ إصدار جديد بكل التعديلات.", { exact: true }),
    ).toBeVisible();
    expect(
      (await snapshot()).version.files.some(
        (file: { path: string }) => file.path === "README.md",
      ),
    ).toBe(false);

    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/nova-files-mobile-ar.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Project files", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Back to project", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Multi-file project", exact: true }),
    ).toBeVisible();
    await expect(page.locator("iframe.generation-preview")).toHaveCount(0);
    expect(
      (
        await (
          await page.request.get(`/api/projects/${project}/generation`)
        ).json()
      ).runs,
    ).toEqual([]);

    const otherSignup = await signupFixture(() =>
      other.request.post(`${baseURL}/api/auth/sign-up/email`, {
        headers: { Origin: origin },
        data: {
          email: `files-other-${randomUUID()}@example.com`,
          password: "Other-workspace-2026!",
          name: "Other owner",
        },
      }),
    );
    expect(otherSignup.ok()).toBe(true);
    for (const suffix of ["", `/export?version=${first.id}`]) {
      expect(
        (await other.request.get(`${baseURL}${base}${suffix}`)).status(),
      ).toBe(404);
    }
    for (const suffix of ["", "/restore", "/template"]) {
      expect(
        (
          await other.request.post(`${baseURL}${base}${suffix}`, {
            headers: { Origin: origin },
            data: {},
          })
        ).status(),
      ).toBe(404);
    }
    // Next streams the surrounding layout before resolving notFound(), so the
    // page body is the ownership assertion; JSON endpoints above return 404.
    const otherPage = await other.newPage();
    await otherPage.goto(`${baseURL}/app/projects/${project}/files`);
    await expect(
      otherPage.getByText("هذه الصفحة غير متاحة.", { exact: true }),
    ).toBeVisible();
    await expect(
      otherPage.getByText("Full-stack workspace", { exact: true }),
    ).toHaveCount(0);
    await expect(otherPage.locator(".file-workspace")).toHaveCount(0);

    // Deleting every file remains a real immutable version, and static creation
    // can start again from that exact base without a preview-load dead end.
    const empty = await post("", {
      baseVersionId: (await snapshot()).version.id,
      files: [],
    });
    expect(empty.status()).toBe(201);
    const emptyVersion = (await empty.json()).version;
    const emptyRead = await page.request.get(
      `/api/projects/${project}/versions/${emptyVersion.id}`,
    );
    expect(emptyRead.status()).toBe(200);
    expect((await emptyRead.json()).version.files).toEqual([]);
    await page.reload();
    await page
      .getByRole("button", { name: "Edit latest version", exact: true })
      .click();
    await page
      .getByLabel("Edit index.html", { exact: true })
      .fill("<h1>Restarted from empty</h1>");
    await page
      .getByRole("button", { name: "Save a new version", exact: true })
      .click();
    await expect(
      page
        .frameLocator("iframe.generation-preview")
        .getByRole("heading", { name: "Restarted from empty", exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.allSettled([anonymous.close(), other.close()]);
    projects.remove(user.id, project);
    db.close();
  }
});

test("file workspace blocks editing before a successful initial read", async ({
  page,
  baseURL,
}) => {
  if (!baseURL || !process.env.NOVA_E2E_DATABASE_PATH)
    throw new Error("Isolated database required");
  const signup = await signupFixture(() =>
    page.request.post("/api/auth/sign-up/email", {
      headers: { Origin: new URL(baseURL).origin },
      data: {
        email: `files-error-${randomUUID()}@example.com`,
        password: "Workspace-errors-2026!",
        name: "Error reviewer",
      },
    }),
  );
  expect(signup.ok()).toBe(true);
  const { user } = await signup.json();
  const db = new Database(process.env.NOVA_E2E_DATABASE_PATH);
  db.pragma("foreign_keys = ON");
  const projects = projectStore(db);
  const project = projects.create(user.id, {
    name: "Failed file read",
    brief: "Do not allow edits based on an unknown source version.",
  });
  const endpoint = `**/api/projects/${project}/workspace`;
  try {
    await page.route(endpoint, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"workspace_failed"}',
      }),
    );
    await page.goto(`/app/projects/${project}/files`);
    await expect(page.locator(".file-workspace [role=alert]")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ملف جديد", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "احفظ إصدارًا", exact: true }),
    ).toBeDisabled();
    await page.unroute(endpoint);
    await page
      .getByRole("button", { name: "أعد المحاولة", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "ملف جديد", exact: true }),
    ).toBeEnabled();
  } finally {
    projects.remove(user.id, project);
    db.close();
  }
});
