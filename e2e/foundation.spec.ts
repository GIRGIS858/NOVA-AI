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
