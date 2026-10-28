import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const projectInput = z.object({
  name: z.string().trim().min(2).max(80),
  brief: z.string().trim().min(10).max(8000),
});
export const messageInput = z.string().trim().min(1).max(8000);
export type Project = {
  id: string;
  owner_id: string;
  name: string;
  brief: string;
  updated_at: string;
};
export type Message = { id: string; content: string; created_at: string };

export function projectStore(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
    brief TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner_id, updated_at);
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_project ON messages(project_id, created_at);`);
  const get = (owner: string, id: string) =>
    db
      .prepare("SELECT * FROM projects WHERE id = ? AND owner_id = ?")
      .get(id, owner) as Project | undefined;
  return {
    get,
    list(owner: string) {
      return db
        .prepare(
          "SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC",
        )
        .all(owner) as Project[];
    },
    create(owner: string, input: unknown) {
      const data = projectInput.parse(input);
      const id = randomUUID();
      db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?)").run(
        id,
        owner,
        data.name,
        data.brief,
        new Date().toISOString(),
      );
      return id;
    },
    messages(owner: string, id: string) {
      if (!get(owner, id)) return [];
      return db
        .prepare(
          "SELECT id, content, created_at FROM messages WHERE project_id = ? ORDER BY created_at, rowid",
        )
        .all(id) as Message[];
    },
    recentMessages(owner: string, id: string) {
      if (!get(owner, id)) return [];
      return (
        db
          .prepare(
            "SELECT id, content, created_at FROM messages WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 8",
          )
          .all(id) as Message[]
      ).reverse();
    },
    addMessage(owner: string, id: string, content: unknown) {
      const value = messageInput.parse(content);
      return db.transaction(() => {
        if (!get(owner, id)) throw new Error("Project unavailable");
        const now = new Date().toISOString();
        db.prepare("INSERT INTO messages VALUES (?, ?, ?, ?)").run(
          randomUUID(),
          id,
          value,
          now,
        );
        db.prepare(
          "UPDATE projects SET updated_at = ? WHERE id = ? AND owner_id = ?",
        ).run(now, id, owner);
      })();
    },
    remove(owner: string, id: string) {
      return (
        db
          .prepare("DELETE FROM projects WHERE id = ? AND owner_id = ?")
          .run(id, owner).changes > 0
      );
    },
  };
}
