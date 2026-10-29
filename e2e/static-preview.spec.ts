import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Run the actual sanitizer with Node's loader. Playwright's custom TS loader
// cannot link sanitize-html's CommonJS -> ESM htmlparser2 dependency.
function staticPreview(source: string) {
  return execFileSync(
    process.execPath,
    [
      "--import", "tsx", "--input-type=module", "-e",
      "import { staticPreview } from './src/lib/static-preview.ts'; import { readFileSync } from 'node:fs'; process.stdout.write(staticPreview(readFileSync(0, 'utf8')));",
    ],
    { input: source, encoding: "utf8" },
  );
}
test("static preview blocks scripts, resources, navigation, and forms", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://evil.invalid")) requests.push(r.url());
  });
  const html = staticPreview(
    `<meta http-equiv="refresh" content="0;url=https://evil.invalid/refresh"><base href="https://evil.invalid/"><style>@import url('https://evil.invalid/import'); body{background-image:url('https://evil.invalid/css')}</style><script>top.location='https://evil.invalid/script'</script><img src="https://evil.invalid/img" onerror="alert(1)"><iframe src="https://evil.invalid/frame"></iframe><object data="https://evil.invalid/object"></object><form action="https://evil.invalid/form"><input><button>Submit</button></form><a href="https://evil.invalid/link" target="_top">Outside</a><h1>Safe preview</h1>`,
  );
  await page.setContent(
    '<iframe title="Static preview" sandbox="" referrerpolicy="no-referrer"></iframe>',
  );
  await page.locator("iframe").evaluate((node, source) => {
    (node as HTMLIFrameElement).srcdoc = source;
  }, html);
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Safe preview" }),
  ).toBeVisible();
  await expect(
    frame.locator("script,meta[http-equiv=refresh],base,iframe,object,form"),
  ).toHaveCount(0);
  await expect(frame.locator("button")).toBeDisabled();
  await frame.getByRole("link", { name: "Outside" }).click();
  await expect.poll(() => page.frames()[1]?.url()).toMatch(/^about:srcdoc/);
  expect(page.url()).toBe("about:blank");
  expect(requests).toEqual([]);
  await expect(page.locator("iframe")).toHaveAttribute("sandbox", "");
});
