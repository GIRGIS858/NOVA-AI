import { expect, type APIResponse } from "@playwright/test";

// Other workflows share localhost's IP. Respect Better Auth's real signup limit
// during fixture setup instead of disabling it or spoofing client addresses.
export async function signupFixture(create: () => Promise<APIResponse>) {
  let response = await create();
  if (response.status() === 429) {
    const seconds = Number(response.headers()["x-retry-after"]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(10);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 100));
    response = await create();
  }
  return response;
}
