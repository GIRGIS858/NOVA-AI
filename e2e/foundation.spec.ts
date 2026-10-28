import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Arabic account → persisted project → notes → ownership → sign out", async ({
  page,
  browser,
}) => {
  const email = `nova-${randomUUID()}@example.com`;
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page
    .locator("#idea")
    .fill("موقع لاستوديو معماري بتصميم هادئ وصفحات للأعمال والتواصل");
  await page.getByRole("button", { name: "ابدأ مشروعك" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "حساب جديد", exact: true }).click();
  await page
    .getByRole("textbox", { name: "اسمك", exact: true })
    .fill("Nova Builder");
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill(email);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("A-unique-test-password-2026!");
  await page.getByRole("button", { name: "أنشئ مساحة لأفكارك" }).click();
  await expect(page).toHaveURL(/\/app\?idea=/);
  await expect(page.getByLabel("الفكرة والأهداف")).toHaveValue(
    /استوديو معماري/,
  );
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
  await page.screenshot({ path: "/tmp/nova-studio.png", fullPage: true });

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  const signup = await other.request.post(
    "http://localhost:3000/api/auth/sign-up/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: {
        email: `other-${randomUUID()}@example.com`,
        password: "Another-unique-password-2026!",
        name: "Other user",
      },
    },
  );
  expect(signup.ok()).toBe(true);
  await otherPage.goto(url);
  await expect(otherPage.getByText("هذه الصفحة غير متاحة.")).toBeVisible();
  await expect(
    otherPage.getByText("استخدم ألوانًا ترابية وخطًا عربيًا واضحًا."),
  ).toHaveCount(0);
  await other.close();

  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await page.goto(url);
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill(email);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("A-unique-test-password-2026!");
  await page.locator(".auth-form").getByRole("button").click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("link", { name: /استوديو مدى/ })).toBeVisible();
});

test("responsive landing and language switching", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "/tmp/nova-home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/nova-home-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("h1")).toContainText("Your next big idea");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
