import "server-only";
import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { authOptions } from "./auth-options";

export const auth = betterAuth(authOptions(db));
export async function session() {
  return auth.api.getSession({ headers: await headers() });
}
export async function requireUser() {
  const value = await session();
  if (!value) redirect("/login");
  return value.user;
}
