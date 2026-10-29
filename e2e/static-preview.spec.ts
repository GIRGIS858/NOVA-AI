import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
// Use Node's loader for sanitize-html's CJS -> ESM dependency, not Playwright's.
function buildPreview(files: Array<{ path: string; content: string }>) {
  return execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "import { buildPreview } from './src/lib/static-artifact.ts'; import { readFileSync } from 'node:fs'; process.stdout.write(buildPreview(JSON.parse(readFileSync(0, 'utf8'))));",
    ],
    { input: JSON.stringify(files), encoding: "utf8" },
  );
}

// Hostile fixture artifacts exercise the preview boundary without an AI provider.
// These are test inputs, not generated output or evidence of live-provider success.
test("static preview keeps hostile artifacts isolated and performs no network navigation", async ({
  page,
}) => {
  const requests: string[] = [];
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.route("**/*", async (route) => {
    requests.push(route.request().url());
    if (route.request().url() === "https://preview-parent.test/app") {
      await route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><body><h1>Application remains intact</h1><iframe title="Fixture preview" sandbox="" referrerpolicy="no-referrer"></iframe></body></html>',
      });
    } else {
      await route.abort();
    }
  });
  await page.goto("https://preview-parent.test/app");
  const source = [
    {
      path: "index.html",
      content: `<!doctype html><html lang="en"><head><meta http-equiv="refresh" content="0;url=https://outside.test/refresh"><base href="https://outside.test/"></head><body>
        <h1>Static fixture</h1>
        <script>top.document.body.innerHTML = "Escaped"; alert("executed"); fetch("https://outside.test/script")</script>
        <svg onload="alert('svg')"><script>alert('svg script')</script></svg>
        <a href="#details">Jump to details</a>
        <a href="https://outside.test/link" target="_top">External link</a>
        <a href="javascript:alert(1)">Script link</a>
        <form action="https://outside.test/submit"><input name="private"><button>Submit</button></form>
        <iframe src="https://outside.test/frame"></iframe>
        <img src="https://outside.test/image" onerror="alert('image')">
        <div id="details">Safe details</div>
      </body></html>`,
    },
    {
      path: "styles.css",
      content:
        '@import url("https://outside.test/style.css"); body { background-image: url("https://outside.test/background"); color: rgb(12, 34, 56); } </style><script>alert("style escape")</script>',
    },
  ];
  const preview = page.getByTitle("Fixture preview");
  await expect(preview).toHaveAttribute("sandbox", "");
  await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");
  await preview.evaluate((element, document) => {
    (element as HTMLIFrameElement).srcdoc = document;
  }, buildPreview(source));
  const frame = page.frameLocator('iframe[title="Fixture preview"]');
  await expect(
    frame.getByRole("heading", { name: "Static fixture" }),
  ).toBeVisible();
  await expect(frame.locator("body")).toHaveCSS("color", "rgb(12, 34, 56)");
  await expect(
    frame.locator("script, svg, form, input, iframe, base"),
  ).toHaveCount(0);
  await expect(
    frame.locator("a").filter({ hasText: "External link" }),
  ).not.toHaveAttribute("href");
  await expect(
    frame.locator("a").filter({ hasText: "Script link" }),
  ).not.toHaveAttribute("href");
  await frame.locator("a").filter({ hasText: "External link" }).click();
  await frame.getByRole("link", { name: "Jump to details" }).click();
  await expect(frame.getByText("Safe details")).toBeVisible();
  await expect.poll(() => page.frames()[1]?.url()).toBe("about:srcdoc#details");
  expect(
    await preview.evaluate((element) => {
      try {
        void (element as HTMLIFrameElement).contentWindow!.document;
        return false;
      } catch (error) {
        return error instanceof DOMException && error.name === "SecurityError";
      }
    }),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Application remains intact" }),
  ).toBeVisible();
  await expect(page).toHaveURL("https://preview-parent.test/app");
  expect(dialogs).toEqual([]);
  expect(requests).toEqual(["https://preview-parent.test/app"]);
});
