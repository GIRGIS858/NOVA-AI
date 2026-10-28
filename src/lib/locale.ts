import { cookies } from "next/headers";
export type Locale = "ar" | "en";
export async function getLocale(): Promise<Locale> {
  return (await cookies()).get("nova-locale")?.value === "en" ? "en" : "ar";
}
