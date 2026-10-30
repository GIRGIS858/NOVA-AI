import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projects } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { ProjectFileWorkspace } from "@/components/project-file-workspace";
import "./files.css";

export const metadata = { title: "Project files" };
export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = projects.get(user.id, id);
  if (!project) notFound();
  return (
    <ProjectFileWorkspace
      key={id}
      projectId={id}
      projectName={project.name}
      ar={(await getLocale()) === "ar"}
    />
  );
}
