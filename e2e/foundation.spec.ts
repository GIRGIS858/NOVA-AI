import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("Arabic account → persisted project → notes → ownership → sign out", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const email = `nova-${randomUUID()}@example.com`;
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page
    .locator("#idea")
    .fill("موقع لاستوديو معماري بتصميم هادئ وصفحات للأعمال والتواصل");
  await page.getByRole("button", { name: "ابدأ مشروعك" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(page.url()).not.toContain("idea=");
  expect(decodeURIComponent(page.url())).not.toContain("استوديو معماري");
  await page.getByRole("button", { name: "حساب جديد", exact: true }).click();
  await page
    .getByRole("textbox", { name: "اسمك", exact: true })
    .fill("Nova Builder");
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill(email);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("A-unique-test-password-2026!");
  await page.getByRole("button", { name: "أنشئ مساحة لأفكارك" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByLabel("الفكرة والأهداف")).toHaveValue(
    /استوديو معماري/,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
  await page.getByLabel("اسم المشروع").fill("استوديو مدى");
  await page.getByRole("button", { name: "أنشئ المشروع", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/projects\//);
  const url = page.url();
  await page
    .getByLabel("أضف تفاصيل إلى المشروع")
    .fill("استخدم ألوانًا ترابية وخطًا عربيًا واضحًا.");
  await page.getByRole("button", { name: "احفظ الملاحظة" }).click();
  await expect(
    page.getByText("استخدم ألوانًا ترابية وخطًا عربيًا واضحًا.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("استخدم ألوانًا ترابية وخطًا عربيًا واضحًا.", {
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("studio-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("studio-desktop.png"),
    fullPage: true,
  });

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  const signup = await other.request.post(`${baseURL}/api/auth/sign-up/email`, {
    headers: { Origin: baseURL! },
    data: {
      email: `other-${randomUUID()}@example.com`,
      password: "Another-unique-password-2026!",
      name: "Other user",
    },
  });
  expect(signup.ok()).toBe(true);
  await otherPage.goto(url);
  await expect(otherPage.getByText("هذه الصفحة غير متاحة.")).toBeVisible();
  await expect(
    otherPage.getByText("استخدم ألوانًا ترابية وخطًا عربيًا واضحًا."),
  ).toHaveCount(0);
  await other.close();

  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await page.goto(url);
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill(email);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("A-unique-test-password-2026!");
  await page
    .getByRole("button", { name: "ادخل مساحة العمل", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("link", { name: /استوديو مدى/ })).toBeVisible();

  // Deletion requires an explicit second action, and cancel must preserve data.
  await page.getByRole("link", { name: /استوديو مدى/ }).click();
  await page.getByRole("button", { name: "حذف المشروع", exact: true }).click();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("استخدم ألوانًا ترابية وخطًا عربيًا واضحًا.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "حذف المشروع", exact: true }).click();
  await page.getByRole("button", { name: "نعم، احذف", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("link", { name: /استوديو مدى/ })).toHaveCount(0);
  await page.goto(url);
  await expect(page.getByText("هذه الصفحة غير متاحة.")).toBeVisible();
});

test("repeated redirect parameters render a usable login form", async ({
  page,
}) => {
  const response = await page.goto("/login?next=/app&next=/app");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("textbox", { name: "البريد الإلكتروني" }),
  ).toBeVisible();
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toBeVisible();
});

test("responsive landing and language switching", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator("h1")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("home-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("h1")).toHaveText(/\S/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectNoHorizontalOverflow(page);
});

test("workspace suggestions, mobile locales, and confirmed project deletion", async ({
  page,
  baseURL,
}, testInfo) => {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: baseURL! },
    data: {
      email: `workspace-${randomUUID()}@example.com`,
      password: "Workspace-test-password-2026!",
      name: "Workspace reviewer",
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const suggestions = page.locator(".suggestion-grid button");
  await expect(suggestions).toHaveCount(3);
  await suggestions.first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByLabel("اسم المشروع")).not.toHaveValue("");
  await expect(page.getByLabel("الفكرة والأهداف")).not.toHaveValue("");
  await expect(page.getByLabel("الفكرة والأهداف")).toBeFocused();
  await page.getByLabel("اسم المشروع").fill("My existing project");
  const existingBrief = "Keep my original requirements.";
  await page.getByLabel("الفكرة والأهداف").fill(existingBrief);
  await suggestions.nth(1).click();
  await expect(page.getByLabel("اسم المشروع")).toHaveValue(
    "My existing project",
  );
  await expect(page.getByLabel("الفكرة والأهداف")).toHaveValue(
    new RegExp(`^${existingBrief.replaceAll(".", "\\.")}\\n\\n.+`),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("workspace-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workspace-mobile-ar.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workspace-mobile-en.png"),
    fullPage: true,
  });

  const projectName = `Workspace check ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Project name", { exact: true }).fill(projectName);
  await page
    .getByLabel("Your idea and goals")
    .fill("A portfolio for an independent creative studio.");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/projects\//);
  const projectUrl = page.url();
  const literalNote = '<img src=x onerror="alert(1)">';
  await page.getByLabel("Add to your project brief").fill(literalNote);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText(literalNote, { exact: true })).toBeVisible();
  await expect(page.locator(".user-message img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(projectName);
  await expect(page.getByText(literalNote, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("link", { name: new RegExp(projectName) }),
  ).toHaveCount(0);
  await page.goto(projectUrl);
  await expect(page.getByText("This page isn’t available.")).toBeVisible();
});
