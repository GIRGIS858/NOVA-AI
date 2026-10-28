"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { projects } from "@/lib/db";
import { projectInput, messageInput } from "@/lib/projects";

export async function switchLocale(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "ar";
  (await cookies()).set("nova-locale", locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
export async function createProject(form: FormData) {
  const user = await requireUser();
  const input = projectInput.safeParse({
    name: form.get("name"),
    brief: form.get("brief"),
  });
  if (!input.success) redirect("/app?error=validation");
  const id = projects.create(user.id, input.data);
  redirect(`/app/projects/${id}`);
}
export async function saveMessage(id: string, form: FormData) {
  const user = await requireUser();
  const input = messageInput.safeParse(form.get("message"));
  if (!projects.get(user.id, id)) redirect("/app");
  if (!input.success) redirect(`/app/projects/${id}?error=validation`);
  projects.addMessage(user.id, id, input.data);
  revalidatePath(`/app/projects/${id}`);
}
export async function deleteProject(id: string) {
  const user = await requireUser();
  projects.remove(user.id, id);
  revalidatePath("/app");
  redirect("/app");
}
